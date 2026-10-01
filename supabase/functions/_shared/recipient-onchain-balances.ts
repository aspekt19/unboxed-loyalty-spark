// Aggregates loyalty token list for a wallet from multiple DB sources
// (loyalty_programs ∪ token_mint_history ∪ customer_tier_status) and reads
// actual on-chain balances via ERC-20 balanceOf — same data path as the UI.
//
// Why: customer_tier_status in DB is not always backfilled for historical mints
// or transfers, so the recipient API used to return empty `balances` while the
// UI (which queries chain directly) showed non-zero amounts. This helper makes
// API parity with UI.

import { createPublicClient, http, fallback, formatUnits, parseAbiItem, type Address } from "npm:viem@2.46.0";
import { base } from "npm:viem@2.46.0/chains";
import { BASE_RPC_URLS } from "./base-rpc.ts";

const ERC20_BALANCE_ABI = [
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

const publicClient = createPublicClient({
  chain: base,
  transport: fallback(
    BASE_RPC_URLS.map((url) => http(url, { batch: false, retryCount: 2, retryDelay: 1_000 })),
  ),
});

/** One-shot client for the assistant. No retry chain — a slow RPC must not stall chat. */
const fastClient = createPublicClient({
  chain: base,
  transport: http(BASE_RPC_URLS[0], { batch: true, timeout: 4_000, retryCount: 0 }),
});

export interface OnchainLoyaltyBalance {
  token_address: string;
  current_balance: number; // human (formatUnits 18)
  raw_balance: string; // wei as string for precision
  tokens_earned_total: number; // from DB tier status if known, else 0
  current_tier_id: string | null;
  last_calculated_at: string | null;
  program: { name: string; symbol: string; status: string; merchant_address?: string } | null;
}

/**
 * Collect every loyalty token address ever associated with a wallet:
 *  - rows in customer_tier_status (DB aggregate)
 *  - rows in token_mint_history where wallet was recipient
 *  - all active loyalty_programs (so users can hold transferred-in tokens)
 *
 * Then read on-chain balanceOf(wallet) for each unique token via viem,
 * keep only > 0 (or those that already had a tier row), and merge with
 * loyalty_programs metadata + existing tier data when present.
 */
export async function loadOnchainLoyaltyBalances(
  serviceClient: any,
  walletAddress: string,
): Promise<OnchainLoyaltyBalance[]> {
  const wallet = walletAddress.toLowerCase();

  // 1) Collect candidate token addresses from 3 sources in parallel.
  const [tiersRes, mintsRes, programsRes] = await Promise.all([
    serviceClient
      .from("customer_tier_status")
      .select("token_address, current_balance, tokens_earned_total, current_tier_id, last_calculated_at")
      .ilike("customer_address", wallet),
    serviceClient
      .from("token_mint_history")
      .select("token_address")
      .ilike("recipient_address", wallet),
    serviceClient
      .from("loyalty_programs")
      .select("token_address, name, symbol, status, merchant_address")
      .in("status", ["active", "expiring_soon", "paused"]),
  ]);

  const tierRows: Array<{
    token_address: string;
    current_balance: number | null;
    tokens_earned_total: number | null;
    current_tier_id: string | null;
    last_calculated_at: string | null;
  }> = tiersRes.data || [];
  const mintRows: Array<{ token_address: string }> = mintsRes.data || [];
  const programRows: Array<{
    token_address: string;
    name: string;
    symbol: string;
    status: string;
    merchant_address: string;
  }> = programsRes.data || [];

  const tierByToken = new Map<string, (typeof tierRows)[number]>();
  for (const t of tierRows) tierByToken.set(t.token_address.toLowerCase(), t);

  const programByToken = new Map<string, (typeof programRows)[number]>();
  for (const p of programRows) programByToken.set(p.token_address.toLowerCase(), p);

  const candidateTokens = new Set<string>();
  for (const t of tierRows) candidateTokens.add(t.token_address.toLowerCase());
  for (const m of mintRows) candidateTokens.add(m.token_address.toLowerCase());
  // Also include all active programs — the wallet may hold tokens received via
  // P2P swaps or direct transfers that never went through token_mint_history.
  // The UI does the same (scans every known program via balanceOf), so API
  // must mirror it for parity.
  for (const p of programRows) candidateTokens.add(p.token_address.toLowerCase());

  if (candidateTokens.size === 0) return [];

  // 2) Read on-chain balanceOf in parallel.
  const tokens = Array.from(candidateTokens);
  const balanceResults = await Promise.all(
    tokens.map(async (tokenAddress) => {
      try {
        const raw = (await publicClient.readContract({
          address: tokenAddress as Address,
          abi: ERC20_BALANCE_ABI,
          functionName: "balanceOf",
          args: [wallet as Address],
        })) as bigint;
        return { tokenAddress, raw, ok: true as const };
      } catch (_err) {
        return { tokenAddress, raw: 0n, ok: false as const };
      }
    }),
  );

  // 3) Merge into final shape; keep tokens with on-chain > 0 OR with existing tier row.
  const out: OnchainLoyaltyBalance[] = [];
  for (const { tokenAddress, raw, ok } of balanceResults) {
    const tier = tierByToken.get(tokenAddress);
    const program = programByToken.get(tokenAddress) || null;
    const human = Number(formatUnits(raw, 18));

    if (!ok && !tier) continue;
    if (raw === 0n && !tier) continue;

    out.push({
      token_address: tokenAddress,
      current_balance: human,
      raw_balance: raw.toString(),
      tokens_earned_total: Number(tier?.tokens_earned_total ?? human),
      current_tier_id: tier?.current_tier_id ?? null,
      last_calculated_at: tier?.last_calculated_at ?? null,
      program: program
        ? {
            name: program.name,
            symbol: program.symbol,
            status: program.status,
            merchant_address: program.merchant_address,
          }
        : null,
    });
  }

  return out;
}

/**
 * Balances the customer portal shows, without walking every token one RPC at a time.
 * One SQL read of active programs, then batched balanceOf. Throws if the chain read fails
 * so the caller can fall back to the portal ledger.
 */
export async function loadHolderBalancesFast(
  serviceClient: any,
  walletAddress: string,
): Promise<OnchainLoyaltyBalance[]> {
  const wallet = walletAddress.toLowerCase();
  const { data, error } = await serviceClient
    .from("loyalty_programs")
    .select("token_address, name, symbol, status, merchant_address")
    .in("status", ["active", "expiring_soon", "paused"]);
  if (error) throw error;
  const programs = (data ?? []) as Array<{
    token_address: string;
    name: string;
    symbol: string;
    status: string;
    merchant_address: string;
  }>;
  if (programs.length === 0) return [];

  const contracts = programs.map((program) => ({
    address: program.token_address as Address,
    abi: ERC20_BALANCE_ABI,
    functionName: "balanceOf" as const,
    args: [wallet as Address],
  }));

  const chunks: typeof contracts[] = [];
  for (let i = 0; i < contracts.length; i += 60) chunks.push(contracts.slice(i, i + 60));
  const settled = await Promise.all(
    chunks.map((chunk) => fastClient.multicall({ contracts: chunk, allowFailure: true })),
  );
  const results = settled.flat();

  const out: OnchainLoyaltyBalance[] = [];
  programs.forEach((program, i) => {
    const result = results[i];
    if (!result || result.status !== "success") return;
    const raw = result.result as bigint;
    if (raw <= 0n) return;
    const human = Number(formatUnits(raw, 18));
    out.push({
      token_address: program.token_address.toLowerCase(),
      current_balance: human,
      raw_balance: raw.toString(),
      tokens_earned_total: human,
      current_tier_id: null,
      last_calculated_at: null,
      program: {
        name: program.name,
        symbol: program.symbol,
        status: program.status,
        merchant_address: program.merchant_address,
      },
    });
  });
  return out;
}

const transferEvent = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)",
);

/** Newest outgoing transfers of the portal's loyalty tokens. One log query per token, short block window. */
export async function loadRecentLoyaltySpends(
  serviceClient: any,
  walletAddress: string,
  tokenAddresses: string[],
): Promise<Array<{ label: string; amount: number; blockNumber: string; txHash: string }>> {
  const wallet = walletAddress.toLowerCase() as Address;
  const tokens = [...new Set(tokenAddresses.map((addr) => addr.toLowerCase()))].slice(0, 12);
  if (tokens.length === 0) return [];
  const latest = await fastClient.getBlockNumber();
  const fromBlock = latest > 10000n ? latest - 10000n : 0n;
  let failures = 0;
  const batches = await Promise.all(tokens.map(async (token) => {
    try {
      return await fastClient.getLogs({
        address: token as Address,
        event: transferEvent,
        args: { from: wallet },
        fromBlock,
        toBlock: latest,
      });
    } catch (err) {
      failures += 1;
      console.error("[loyalty-spends] getLogs", token, err);
      return [];
    }
  }));
  if (failures === tokens.length) throw new Error("all loyalty transfer lookups failed");
  const logs = batches.flat();
  const recent = [...logs].sort((a, b) => Number((b.blockNumber ?? 0n) - (a.blockNumber ?? 0n))).slice(0, 20);
  const tokenAddrs = [...new Set(recent.map((log) => log.address.toLowerCase()))];
  if (tokenAddrs.length === 0) return [];

  const { data } = await serviceClient
    .from("loyalty_programs")
    .select("token_address, name, symbol")
    .or(tokenAddrs.map((addr) => `token_address.ilike.${addr}`).join(","));
  const nameBy = new Map<string, { name: string; symbol: string }>();
  for (const program of (data ?? []) as Array<{ token_address: string; name: string; symbol: string }>) {
    nameBy.set(program.token_address.toLowerCase(), { name: program.name, symbol: program.symbol });
  }

  const out: Array<{ label: string; amount: number; blockNumber: string; txHash: string }> = [];
  for (const log of recent) {
    const program = nameBy.get(log.address.toLowerCase());
    if (!program || out.length >= 5) continue;
    const raw = log.args.value ?? 0n;
    if (raw <= 0n) continue;
    out.push({
      label: `${program.name} (${program.symbol})`,
      amount: Number(formatUnits(raw, 18)),
      blockNumber: log.blockNumber?.toString() ?? "",
      txHash: log.transactionHash ?? "",
    });
  }
  return out;
}

type ExplorerTokenTx = {
  blockNumber?: string;
  hash?: string;
  from?: string;
  to?: string;
  contractAddress?: string;
  value?: string;
  tokenName?: string;
  tokenSymbol?: string;
  tokenDecimal?: string;
};

const EXPLORER_TOKEN_TX = [
  (wallet: string) =>
    `https://base.blockscout.com/api?module=account&action=tokentx&address=${wallet}&page=1&offset=100&sort=desc`,
  (wallet: string) =>
    `https://api.routescan.io/v2/network/mainnet/evm/8453/etherscan/api?module=account&action=tokentx&address=${wallet}&page=1&offset=100&sort=desc`,
];

async function fetchExplorerTokenTxs(wallet: string): Promise<ExplorerTokenTx[]> {
  let lastError: unknown = null;
  for (const buildUrl of EXPLORER_TOKEN_TX) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8_000);
    try {
      const resp = await fetch(buildUrl(wallet), { signal: controller.signal });
      const body = await resp.json();
      if (Array.isArray(body?.result)) return body.result as ExplorerTokenTx[];
      lastError = body?.message ?? body?.result ?? resp.status;
    } catch (err) {
      lastError = err;
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(`explorer token transfers failed: ${String(lastError)}`);
}

/**
 * Latest B20 and ERC-20 loyalty transfers for a wallet, from a public Base explorer.
 * The explorer returns every token the address touched. Rows are kept only when the
 * contract is one of our loyalty programs.
 */
export async function loadExplorerLoyaltyTransfers(
  serviceClient: any,
  walletAddress: string,
): Promise<Array<{ label: string; amount: number; blockNumber: string; txHash: string; direction: "sent" | "received"; standard: string }>> {
  const wallet = walletAddress.toLowerCase();
  const txs = await fetchExplorerTokenTxs(wallet);
  const contracts = [...new Set(txs.map((tx) => (tx.contractAddress ?? "").toLowerCase()).filter((addr) => /^0x[a-f0-9]{40}$/.test(addr)))];
  if (contracts.length === 0) return [];

  const { data, error } = await serviceClient
    .from("loyalty_programs")
    .select("token_address, name, symbol, token_standard")
    .or(contracts.map((addr) => `token_address.ilike.${addr}`).join(","));
  if (error) throw error;

  const programBy = new Map<string, { name: string; symbol: string; standard: string }>();
  for (const program of (data ?? []) as Array<{ token_address: string; name: string; symbol: string; token_standard: string | null }>) {
    programBy.set(program.token_address.toLowerCase(), {
      name: program.name,
      symbol: program.symbol,
      standard: (program.token_standard ?? "erc20").toLowerCase(),
    });
  }

  const out: Array<{ label: string; amount: number; blockNumber: string; txHash: string; direction: "sent" | "received"; standard: string }> = [];
  for (const tx of txs) {
    const contract = (tx.contractAddress ?? "").toLowerCase();
    const program = programBy.get(contract);
    if (!program || out.length >= 8) continue;
    const raw = BigInt(tx.value ?? "0");
    if (raw <= 0n) continue;
    const decimals = Number(tx.tokenDecimal ?? "18");
    const safeDecimals = Number.isInteger(decimals) && decimals >= 0 && decimals <= 36 ? decimals : 18;
    const direction = (tx.from ?? "").toLowerCase() === wallet ? "sent" as const : "received" as const;
    out.push({
      label: `${program.name} (${program.symbol})`,
      amount: Number(formatUnits(raw, safeDecimals)),
      blockNumber: tx.blockNumber ?? "",
      txHash: tx.hash ?? "",
      direction,
      standard: program.standard,
    });
  }
  return out;
}

/** Block and status of one transaction, read from a Base receipt. */
export async function loadTxReceiptBlock(txHash: string): Promise<{ blockNumber: string; status: string; txHash: string } | null> {
  const hash = (txHash.startsWith("0x") ? txHash : `0x${txHash}`) as `0x${string}`;
  const receipt = await fastClient.getTransactionReceipt({ hash });
  return {
    blockNumber: receipt.blockNumber.toString(),
    status: receipt.status,
    txHash: receipt.transactionHash,
  };
}

/**
 * Read on-chain balance for a single (wallet, token) pair, merging tier metadata.
 */
export async function loadOnchainLoyaltyBalance(
  serviceClient: any,
  walletAddress: string,
  tokenAddress: string,
): Promise<OnchainLoyaltyBalance | null> {
  const wallet = walletAddress.toLowerCase();
  const token = tokenAddress.toLowerCase();

  let raw = 0n;
  let onchainOk = true;
  try {
    raw = (await publicClient.readContract({
      address: token as Address,
      abi: ERC20_BALANCE_ABI,
      functionName: "balanceOf",
      args: [wallet as Address],
    })) as bigint;
  } catch (_err) {
    onchainOk = false;
  }

  const [{ data: tier }, { data: program }] = await Promise.all([
    serviceClient
      .from("customer_tier_status")
      .select("current_balance, tokens_earned_total, current_tier_id, last_calculated_at")
      .ilike("customer_address", wallet)
      .ilike("token_address", token)
      .maybeSingle(),
    serviceClient
      .from("loyalty_programs")
      .select("name, symbol, status, merchant_address")
      .ilike("token_address", token)
      .maybeSingle(),
  ]);

  if (!onchainOk && !tier) return null;

  const human = Number(formatUnits(raw, 18));
  return {
    token_address: token,
    current_balance: human,
    raw_balance: raw.toString(),
    tokens_earned_total: Number(tier?.tokens_earned_total ?? human),
    current_tier_id: tier?.current_tier_id ?? null,
    last_calculated_at: tier?.last_calculated_at ?? null,
    program: program
      ? {
          name: program.name,
          symbol: program.symbol,
          status: program.status,
          merchant_address: program.merchant_address,
        }
      : null,
  };
}
