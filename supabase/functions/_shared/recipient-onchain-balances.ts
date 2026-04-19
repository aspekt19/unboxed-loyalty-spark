// Aggregates loyalty token list for a wallet from multiple DB sources
// (loyalty_programs ∪ token_mint_history ∪ customer_tier_status) and reads
// actual on-chain balances via ERC-20 balanceOf — same data path as the UI.
//
// Why: customer_tier_status in DB is not always backfilled for historical mints
// or transfers, so the recipient API used to return empty `balances` while the
// UI (which queries chain directly) showed non-zero amounts. This helper makes
// API parity with UI.

import { createPublicClient, http, formatUnits, type Address } from "npm:viem@2.46.0";
import { base } from "npm:viem@2.46.0/chains";

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
  transport: http("https://base-rpc.publicnode.com", {
    batch: false,
    retryCount: 2,
    retryDelay: 1_000,
  }),
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
  // Note: we DO NOT pre-add every program — that would explode RPC cost.
  // We only add programs the wallet has ever interacted with (via mint history or tier).

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
