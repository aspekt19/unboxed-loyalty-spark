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
): Promise<string> {
  if (role === "merchant") return merchantContext(service, wallet);
  return shopperContext(service, wallet);
}

async function shopperContext(service: Db, wallet: string): Promise<string> {
  const { loadOnchainLoyaltyBalances } = await import("./recipient-onchain-balances.ts");
  const [balances, vouchersRes, certsRes, offersRes] = await Promise.all([
    loadOnchainLoyaltyBalances(service, wallet),
    service.from("vouchers").select("reward_name, status, token_symbol, code").ilike("customer_address", wallet).limit(15),
    service.from("gift_certificates").select("title, status, token_symbol, token_amount").ilike("redeemed_by", wallet).limit(10),
    service.from("marketplace_offers").select("status, offer_amount, request_amount").ilike("creator_address", wallet).eq("status", "active").limit(8),
  ]);

  const held = (balances as Array<{ current_balance: number; program: { name: string; symbol: string } | null }>)
    .filter((b) => b.current_balance > 0 && b.program)
    .slice(0, 20)
    .map((b) => `- ${b.program!.name} (${b.program!.symbol}): ${amt(b.current_balance)}`);

  const vouchers = ((vouchersRes.data ?? []) as Array<{ reward_name: string; status: string; token_symbol: string; code: string }>)
    .map((v) => `- ${v.reward_name} [${v.status}] ${v.token_symbol} code ${v.code}`);
  const certs = ((certsRes.data ?? []) as Array<{ title: string; status: string; token_symbol: string | null; token_amount: number }>)
    .map((c) => `- ${c.title} [${c.status}] ${amt(c.token_amount)} ${c.token_symbol ?? ""}`.trim());
  const offers = ((offersRes.data ?? []) as Array<{ status: string; offer_amount: number; request_amount: number }>)
    .map((o) => `- P2P ${o.status}: offer ${amt(o.offer_amount)} for ${amt(o.request_amount)}`);

  return [
    `Wallet ${wallet}. This is the signed-in shopper only.`,
    lines("Loyalty balances (stores they hold points with)", held),
    lines("Vouchers", vouchers),
    lines("Gift certificates claimed", certs),
    lines("Open P2P offers they created", offers),
  ].join("\n");
}

async function merchantContext(service: Db, wallet: string): Promise<string> {
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
