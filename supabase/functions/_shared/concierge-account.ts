/**
 * Signed-in account snapshot for the Concierge.
 * Only the caller's wallet. Passed to SERV after the Loyal Spark scope gate.
 */

type Db = { from: (table: string) => any };

function amt(n: number): string {
  if (!Number.isFinite(n)) return "0";
  const rounded = Math.round(n * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

function lines(title: string, rows: string[]): string {
  if (rows.length === 0) return `${title}: none`;
  return `${title}:\n${rows.join("\n")}`;
}

export async function loadAccountContext(
  service: Db,
  role: "merchant" | "shopper",
  wallet: string,
  question = "",
): Promise<string> {
  if (role === "merchant") return merchantContext(service, wallet);
  // Single shopper read-model: see agent-context.ts.
  void question;
  const { buildShopperAgentContext } = await import("./agent-context.ts");
  return (await buildShopperAgentContext(service, wallet)).contextText;
}

export async function merchantContext(service: Db, wallet: string): Promise<string> {
  const [profileRes, programsRes, rewardsRes, vouchersRes, certsRes, mintsRes] = await Promise.all([
    service.from("merchant_profiles").select("business_name, category").eq("merchant_address", wallet).maybeSingle(),
    service.from("loyalty_programs").select("name, symbol, status, cashback_rate, points_per_dollar").eq("merchant_address", wallet).limit(20),
    service.from("rewards").select("name, cost, is_active, token_address").eq("merchant_address", wallet).limit(20),
    service.from("vouchers").select("reward_name, status, token_symbol").eq("merchant_address", wallet).order("activated_at", { ascending: false }).limit(12),
    service.from("gift_certificates").select("title, status, token_amount").eq("merchant_address", wallet).limit(10),
    service.from("token_mint_history").select("token_symbol, amount, recipient_address, created_at").eq("merchant_address", wallet).order("created_at", { ascending: false }).limit(8),
  ]);

  const profile = profileRes.data as { business_name?: string; category?: string } | null;
  const programs = ((programsRes.data ?? []) as Array<{ name: string; symbol: string; status: string; cashback_rate: number; points_per_dollar: number }>)
    .map((p) => `- ${p.name} (${p.symbol}) [${p.status}] cashback ${p.cashback_rate}% points/${p.points_per_dollar} per $1`);
  const rewards = ((rewardsRes.data ?? []) as Array<{ name: string; cost: number; is_active: boolean }>)
    .map((r) => `- ${r.name}: ${amt(r.cost)} pts${r.is_active ? "" : " (inactive)"}`);
  const vouchers = ((vouchersRes.data ?? []) as Array<{ reward_name: string; status: string; token_symbol: string }>)
    .map((v) => `- ${v.reward_name} [${v.status}] ${v.token_symbol}`);
  const certs = ((certsRes.data ?? []) as Array<{ title: string; status: string; token_amount: number }>)
    .map((c) => `- ${c.title} [${c.status}] ${amt(c.token_amount)}`);
  const mints = ((mintsRes.data ?? []) as Array<{ token_symbol: string; amount: number; recipient_address: string }>)
    .map((m) => `- ${amt(m.amount)} ${m.token_symbol} → ${m.recipient_address}`);

  return [
    `Wallet ${wallet}. Business: ${profile?.business_name ?? "no profile"}${profile?.category ? ` (${profile.category})` : ""}. This merchant only.`,
    lines("Programs", programs),
    lines("Rewards", rewards),
    lines("Recent vouchers", vouchers),
    lines("Gift certificates", certs),
    lines("Recent mints", mints),
  ].join("\n");
}
