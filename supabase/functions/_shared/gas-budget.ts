/** Shared gas budget rules for paymaster-proxy. Pure functions are unit-tested. */

export type GasSettings = {
  monthly_budget_usd: number;
  sponsor_smart_wallets: boolean;
  est_sponsored_op_usd: number;
};

export function budgetAllows(spentUsd: number, costUsd: number, budgetUsd: number): boolean {
  return spentUsd + costUsd <= budgetUsd;
}

export async function loadGasSettings(sb: { from: (t: string) => any }): Promise<GasSettings> {
  const { data } = await sb.from("gas_settings").select("*").eq("id", 1).maybeSingle();
  const d = data ?? {};
  return {
    monthly_budget_usd: Number(d.monthly_budget_usd ?? 0),
    sponsor_smart_wallets: d.sponsor_smart_wallets ?? false,
    est_sponsored_op_usd: Number(d.est_sponsored_op_usd ?? 0.01),
  };
}
