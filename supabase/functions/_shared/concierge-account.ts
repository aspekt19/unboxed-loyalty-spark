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

function lines(title: string, rows: string[], total?: number): string {
  if (rows.length === 0) return `${title}: none`;
  const head = total != null && total > rows.length
    ? `${title} (${rows.length} of ${total} shown):`
    : `${title} (${rows.length}):`;
  return `${head}\n${rows.join("\n")}`;
}

export async function loadAccountContext(
  service: Db,
  role: "merchant" | "shopper",
  wallet: string,
  question = "",
): Promise<string> {
  if (role === "merchant") return merchantContext(service, wallet);
  void question;
  const { buildShopperAgentContext } = await import("./agent-context.ts");
  return (await buildShopperAgentContext(service, wallet)).contextText;
}

/** Richer merchant snapshot for SERV; full lists still use concierge-merchant facts-first. */
export async function merchantContext(service: Db, wallet: string): Promise<string> {
  const [
    profileRes,
    programsRes,
    programsCountRes,
    rewardsRes,
    rewardsCountRes,
    vouchersActiveRes,
    vouchersExpiredRes,
    vouchersUsedRes,
    certsRes,
    mintsRes,
  ] = await Promise.all([
    service.from("merchant_profiles").select("business_name, category").eq("merchant_address", wallet).maybeSingle(),
    service
      .from("loyalty_programs")
      .select("name, symbol, status, cashback_rate, points_per_dollar, token_address")
      .eq("merchant_address", wallet)
      .order("created_at", { ascending: false })
      .limit(40),
    service
      .from("loyalty_programs")
      .select("id", { count: "exact", head: true })
      .eq("merchant_address", wallet),
    service
      .from("rewards")
      .select("name, cost, is_active")
      .eq("merchant_address", wallet)
      .order("cost", { ascending: true })
      .limit(40),
    service
      .from("rewards")
      .select("id", { count: "exact", head: true })
      .eq("merchant_address", wallet),
    service
      .from("vouchers")
      .select("id", { count: "exact", head: true })
      .eq("merchant_address", wallet)
      .eq("status", "active"),
    service
      .from("vouchers")
      .select("id", { count: "exact", head: true })
      .eq("merchant_address", wallet)
      .eq("status", "expired"),
    service
      .from("vouchers")
      .select("id", { count: "exact", head: true })
      .eq("merchant_address", wallet)
      .eq("status", "used"),
    service
      .from("gift_certificates")
      .select("title, status, token_amount")
      .eq("merchant_address", wallet)
      .limit(20),
    service
      .from("token_mint_history")
      .select("token_symbol, amount, recipient_address, created_at")
      .eq("merchant_address", wallet)
      .order("created_at", { ascending: false })
      .limit(15),
  ]);

  const profile = profileRes.data as { business_name?: string; category?: string } | null;
  const programsTotal = programsCountRes.count ?? 0;
  const rewardsTotal = rewardsCountRes.count ?? 0;
  const vActive = vouchersActiveRes.count ?? 0;
  const vExpired = vouchersExpiredRes.count ?? 0;
  const vUsed = vouchersUsedRes.count ?? 0;

  const programs = ((programsRes.data ?? []) as Array<{
    name: string;
    symbol: string;
    status: string;
    cashback_rate: number;
    points_per_dollar: number;
  }>).map(
    (p) =>
      `- ${p.name} (${p.symbol}) [${p.status}] cashback ${p.cashback_rate}% points/${p.points_per_dollar} per $1`,
  );
  const rewards = ((rewardsRes.data ?? []) as Array<{ name: string; cost: number; is_active: boolean }>).map(
    (r) => `- ${r.name}: ${amt(r.cost)} pts${r.is_active ? "" : " (inactive)"}`,
  );
  const certs = ((certsRes.data ?? []) as Array<{ title: string; status: string; token_amount: number }>).map(
    (c) => `- ${c.title} [${c.status}] ${amt(c.token_amount)}`,
  );
  const mints = ((mintsRes.data ?? []) as Array<{
    token_symbol: string;
    amount: number;
    recipient_address: string;
    created_at: string;
  }>).map((m) => `- ${amt(m.amount)} ${m.token_symbol} → ${m.recipient_address} (${m.created_at})`);

  return [
    `Wallet ${wallet}. Business: ${profile?.business_name ?? "no profile"}${profile?.category ? ` (${profile.category})` : ""}. This merchant only.`,
    `Voucher totals (portal tabs): active ${vActive}, inactive/expired ${vExpired}, used ${vUsed}.`,
    lines("Programs", programs, programsTotal),
    lines("Rewards", rewards, rewardsTotal),
    lines("Gift certificates", certs),
    lines("Recent mints", mints),
    "For full filtered lists the assistant uses tools / deterministic replies — do not invent rows beyond this snapshot.",
  ].join("\n");
}
