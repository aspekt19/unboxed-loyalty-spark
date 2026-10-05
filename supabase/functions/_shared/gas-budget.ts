/** Shared gas budget rules for paymaster-proxy and gas-drip. Pure functions are unit-tested. */

export type GasSettings = {
  monthly_budget_usd: number;
  sponsor_smart_wallets: boolean;
  drip_enabled: boolean;
  drip_amount_usd: number;
  drip_min_balance_usd: number;
  drip_cooldown_days: number;
  drip_max_per_month: number;
  est_sponsored_op_usd: number;
};

export function budgetAllows(spentUsd: number, costUsd: number, budgetUsd: number): boolean {
  return spentUsd + costUsd <= budgetUsd;
}

export type DripInput = {
  settings: GasSettings;
  spentUsd: number;
  walletBalanceUsd: number;
  lastDripAt: Date | null;
  dripsThisMonth: number;
  now: Date;
};

export type DripDecision = { ok: true } | { ok: false; reason: string };

export function decideDrip(i: DripInput): DripDecision {
  const s = i.settings;
  if (!s.drip_enabled) return { ok: false, reason: "drip_disabled" };
  if (i.walletBalanceUsd >= s.drip_min_balance_usd) return { ok: false, reason: "has_gas" };
  if (i.dripsThisMonth >= s.drip_max_per_month) return { ok: false, reason: "wallet_monthly_limit" };
  if (i.lastDripAt && i.now.getTime() - i.lastDripAt.getTime() < s.drip_cooldown_days * 86_400_000) {
    return { ok: false, reason: "wallet_cooldown" };
  }
  if (!budgetAllows(i.spentUsd, s.drip_amount_usd, s.monthly_budget_usd)) return { ok: false, reason: "budget_exhausted" };
  return { ok: true };
}

const CHAINLINK_ETH_USD_BASE = "0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70";
let priceCache: { at: number; usd: number } | null = null;

/** ETH/USD from Chainlink on Base (cached 5 min, fallback 3000). */
export async function ethUsdPrice(
  rpc: (method: string, params: unknown[]) => Promise<unknown>,
): Promise<number> {
  if (priceCache && Date.now() - priceCache.at < 300_000) return priceCache.usd;
  try {
    const res = await rpc("eth_call", [{ to: CHAINLINK_ETH_USD_BASE, data: "0xfeaf968c" }, "latest"]) as string;
    const answer = BigInt("0x" + res.slice(2 + 64, 2 + 128));
    const usd = Number(answer) / 1e8;
    if (usd > 100 && usd < 100_000) {
      priceCache = { at: Date.now(), usd };
      return usd;
    }
  } catch { /* fallback */ }
  return priceCache?.usd ?? 3000;
}

export async function loadGasSettings(sb: { from: (t: string) => any }): Promise<GasSettings> {
  const { data } = await sb.from("gas_settings").select("*").eq("id", 1).maybeSingle();
  const d = data ?? {};
  return {
    monthly_budget_usd: Number(d.monthly_budget_usd ?? 0),
    sponsor_smart_wallets: d.sponsor_smart_wallets ?? false,
    drip_enabled: d.drip_enabled ?? false,
    drip_amount_usd: Number(d.drip_amount_usd ?? 0.02),
    drip_min_balance_usd: Number(d.drip_min_balance_usd ?? 0.005),
    drip_cooldown_days: Number(d.drip_cooldown_days ?? 7),
    drip_max_per_month: Number(d.drip_max_per_month ?? 3),
    est_sponsored_op_usd: Number(d.est_sponsored_op_usd ?? 0.01),
  };
}
