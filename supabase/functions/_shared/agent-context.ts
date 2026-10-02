/**
 * Agent-facing read-model for the in-app Concierge (shopper + merchant).
 *
 * One snapshot per chat turn. Deterministic replies (balances, last spend, redeem)
 * and the SERV ACCOUNT DATA text all read from this object, so the assistant never
 * shows two different numbers for the same wallet.
 *
 * Not a replacement for MCP/REST (lsk_/rwk_). Never signs anything: writes go through
 * actions + UI confirm + the user's own wallet.
 */

import {
  type HeldBalance,
  loadHeldLoyaltyBalances,
  type RedeemableReward,
  rewardsForHeld,
} from "./concierge-redeem.ts";

type Db = { from: (table: string) => any };

export type ShopperAgentContext = {
  identity: { user_id: string | null; wallet: string; role: "shopper" };
  balances: Array<{
    token_address: string;
    program_name: string;
    symbol: string;
    amount: number;
    status: string;
  }>;
  rewards_affordable: RedeemableReward[];
  vouchers_recent: Array<{
    code?: string;
    reward_name: string;
    status: string;
    cost: number;
    token_symbol: string;
    activated_at: string;
  }>;
  last_outgoing: null | {
    label: string;
    amount: number;
    block: string;
    tx_hash: string;
    basescan_url: string;
  };
  capabilities: string[];
  as_of: string;
  source_notes: string[];
};

export type MerchantAgentContext = {
  identity: { user_id: string | null; wallet: string; role: "merchant" };
  capabilities: string[];
  as_of: string;
  source_notes: string[];
};

export type BuiltContext<T> = { context: T; contextText: string };

function amt(n: number): string {
  if (!Number.isFinite(n)) return "0";
  const rounded = Math.round(n * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`${label} timeout`)), ms)),
  ]);
}

// Short in-memory TTL (per edge isolate) — never hours.
const TTL_MS = 15_000;
const cache = new Map<string, { at: number; value: BuiltContext<ShopperAgentContext> }>();

export async function buildShopperAgentContext(
  service: Db,
  walletRaw: string,
  userId: string | null = null,
): Promise<BuiltContext<ShopperAgentContext>> {
  const wallet = walletRaw.toLowerCase();
  const hit = cache.get(wallet);
  if (hit && Date.now() - hit.at < TTL_MS) {
    return { ...hit.value, context: { ...hit.value.context, identity: { ...hit.value.context.identity, user_id: userId } } };
  }

  const notes: string[] = [];
  let balancesOk = true;
  let lastOk = true;

  const balancesP: Promise<HeldBalance[]> = loadHeldLoyaltyBalances(service, wallet).catch((err) => {
    console.error("[agent-context] balances", err);
    balancesOk = false;
    return [];
  });

  const statusP = service
    .from("loyalty_programs")
    .select("token_address, status")
    .in("status", ["active", "expiring_soon", "paused"])
    .then((r: { data: Array<{ token_address: string; status: string }> | null }) =>
      new Map((r.data ?? []).map((p) => [p.token_address.toLowerCase(), p.status]))
    )
    .catch(() => new Map<string, string>());

  const vouchersP = service
    .from("vouchers")
    .select("code, reward_name, status, token_symbol, cost, activated_at")
    .ilike("customer_address", wallet)
    .order("activated_at", { ascending: false })
    .limit(5)
    .then((r: { data: unknown[] | null; error: unknown }) => {
      if (r.error) throw r.error;
      return (r.data ?? []) as ShopperAgentContext["vouchers_recent"];
    })
    .catch((err: unknown) => {
      console.error("[agent-context] vouchers", err);
      notes.push("vouchers: failed");
      return [] as ShopperAgentContext["vouchers_recent"];
    });

  const lastP = (async () => {
    const { loadLastLoyaltySpend } = await import("./recipient-onchain-balances.ts");
    return await withTimeout(loadLastLoyaltySpend(service, wallet), 12_000, "spend");
  })().catch((err) => {
    console.error("[agent-context] last spend", err);
    lastOk = false;
    return null;
  });

  const held = await balancesP;
  const rewardsP = rewardsForHeld(service, held).catch((err) => {
    console.error("[agent-context] rewards", err);
    notes.push("rewards: failed");
    return [] as RedeemableReward[];
  });

  const [statusBy, vouchers, last, rewards] = await Promise.all([statusP, vouchersP, lastP, rewardsP]);

  notes.push(balancesOk ? "balances: multicall (explorer token-balances fallback)" : "balances: failed");
  notes.push(lastOk ? "last_outgoing: base rpc eth_getLogs" : "last_outgoing: failed");

  const context: ShopperAgentContext = {
    identity: { user_id: userId, wallet, role: "shopper" },
    balances: held
      .map((b) => ({
        token_address: b.tokenAddress,
        program_name: b.programName,
        symbol: b.symbol,
        amount: b.amount,
        status: statusBy.get(b.tokenAddress.toLowerCase()) ?? "active",
      }))
      .sort((a, b) => b.amount - a.amount),
    rewards_affordable: rewards,
    vouchers_recent: vouchers.map((v) => ({ ...v, cost: Number(v.cost) })),
    last_outgoing: last
      ? {
        label: last.label,
        amount: last.amount,
        block: last.blockNumber,
        tx_hash: last.txHash,
        basescan_url: `https://basescan.org/tx/${last.txHash}`,
      }
      : null,
    capabilities: ["answer_balances", "answer_last_spend", "pick_reward", "confirm_redeem"],
    as_of: new Date().toISOString(),
    source_notes: notes,
  };

  const built = { context, contextText: shopperContextText(context, balancesOk, lastOk) };
  cache.set(wallet, { at: Date.now(), value: built });
  return built;
}

/** Compact text for SERV ACCOUNT DATA and the local fallback parser in chat-bridge. */
function shopperContextText(c: ShopperAgentContext, balancesOk: boolean, lastOk: boolean): string {
  const out: string[] = [
    `Wallet ${c.identity.wallet}. This is the signed-in shopper. Name this address in the answer. Do not ask them to send it again.`,
    `Snapshot as of ${c.as_of}.`,
  ];
  if (!balancesOk) out.push("Loyalty balances: lookup failed. Do not claim the wallet has no points.");
  else if (c.balances.length === 0) out.push("Loyalty balances: none");
  else {
    out.push("Loyalty balances, same list as the customer portal, highest first:");
    for (const b of c.balances) out.push(`- ${b.program_name} (${b.symbol}): ${amt(b.amount)}`);
  }
  if (!lastOk) out.push("Last loyalty spend: lookup failed");
  else if (!c.last_outgoing) out.push("Last loyalty spend: none");
  else {
    const l = c.last_outgoing;
    out.push(`Last loyalty spend: ${amt(l.amount)} ${l.label} [onchain] | block ${l.block} | tx ${l.tx_hash} | ${l.basescan_url}`);
  }
  if (c.rewards_affordable.length === 0) out.push("Rewards affordable now: none");
  else {
    out.push("Rewards affordable now (the assistant can issue these as vouchers):");
    for (const r of c.rewards_affordable.slice(0, 12)) {
      out.push(`- ${r.name}: ${amt(r.cost)} ${r.token_symbol || r.program_name}`);
    }
  }
  if (c.vouchers_recent.length === 0) out.push("Recent vouchers: none");
  else {
    out.push("Recent vouchers, newest first. A voucher row is not the block number:");
    for (const v of c.vouchers_recent) {
      out.push(`- ${v.activated_at}: ${v.reward_name} [${v.status}] ${amt(v.cost)} ${v.token_symbol}`);
    }
  }
  return out.join("\n");
}

/** Merchant: minimal in this pass — same module/style, text from the existing merchant snapshot. */
export async function buildMerchantAgentContext(
  service: Db,
  walletRaw: string,
  userId: string | null = null,
): Promise<BuiltContext<MerchantAgentContext>> {
  const wallet = walletRaw.toLowerCase();
  const { merchantContext } = await import("./concierge-account.ts");
  const notes: string[] = [];
  let contextText = "";
  try {
    contextText = await merchantContext(service, wallet);
    notes.push("merchant: db snapshot");
  } catch (err) {
    console.error("[agent-context] merchant", err);
    notes.push("merchant: failed");
  }
  return {
    context: {
      identity: { user_id: userId, wallet, role: "merchant" },
      capabilities: ["answer_programs", "answer_rewards"],
      as_of: new Date().toISOString(),
      source_notes: notes,
    },
    contextText,
  };
}
