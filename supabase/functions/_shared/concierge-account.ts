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
  const held = await shopperBalanceLines(service, wallet);
  const [vouchersRes, certsRes, offersRes] = await Promise.all([
    service.from("vouchers").select("reward_name, status, token_symbol, code").ilike("customer_address", wallet).limit(15),
    service.from("gift_certificates").select("title, status, token_symbol, token_amount").ilike("redeemed_by", wallet).limit(10),
    service.from("marketplace_offers").select("status, offer_amount, request_amount").ilike("creator_address", wallet).eq("status", "active").limit(8),
  ]);

  const vouchers = ((vouchersRes.data ?? []) as Array<{ reward_name: string; status: string; token_symbol: string; code: string }>)
    .map((v) => `- ${v.reward_name} [${v.status}] ${v.token_symbol} code ${v.code}`);
  const certs = ((certsRes.data ?? []) as Array<{ title: string; status: string; token_symbol: string | null; token_amount: number }>)
    .map((c) => `- ${c.title} [${c.status}] ${amt(c.token_amount)} ${c.token_symbol ?? ""}`.trim());
  const offers = ((offersRes.data ?? []) as Array<{ status: string; offer_amount: number; request_amount: number }>)
    .map((o) => `- P2P ${o.status}: offer ${amt(o.offer_amount)} for ${amt(o.request_amount)}`);

  return [
    `Wallet ${wallet}. This is the signed-in shopper only. Balances are on-chain and sorted highest first, the same numbers as the customer portal.`,
    lines("Loyalty balances (stores they hold points with)", held),
    lines("Vouchers", vouchers),
    lines("Gift certificates claimed", certs),
    lines("Open P2P offers they created", offers),
  ].join("\n");
}

/** On-chain balances when the RPC answers in time, otherwise the portal ledger. */
async function shopperBalanceLines(service: Db, wallet: string): Promise<string[]> {
  try {
    const { loadHolderBalancesFast } = await import("./recipient-onchain-balances.ts");
    const rows = await Promise.race([
      loadHolderBalancesFast(service, wallet),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("balance timeout")), 4_000)),
    ]);
    const linesOut = rows
      .filter((row) => row.current_balance > 0)
      .sort((a, b) => b.current_balance - a.current_balance)
      .map((row) => {
        const label = row.program ? `${row.program.name} (${row.program.symbol})` : row.token_address;
        return `- ${label}: ${amt(row.current_balance)}`;
      });
    if (linesOut.length > 0) return linesOut;
  } catch (err) {
    console.error("[concierge-account] chain balances", err);
  }
  return shopperHoldingLines(service, wallet);
}

/** DB balances for tokens this wallet already touched. Used when the chain read fails. */
export async function shopperHoldingLines(service: Db, wallet: string): Promise<string[]> {
  const [tiersRes, mintsRes] = await Promise.all([
    service.from("customer_tier_status").select("token_address, current_balance").ilike("customer_address", wallet).limit(30),
    service.from("token_mint_history").select("token_address, amount").ilike("recipient_address", wallet).limit(40),
  ]);
  const byToken = new Map<string, number>();
  for (const row of (tiersRes.data ?? []) as Array<{ token_address: string; current_balance: number | null }>) {
    byToken.set(row.token_address.toLowerCase(), Number(row.current_balance ?? 0));
  }
  for (const row of (mintsRes.data ?? []) as Array<{ token_address: string; amount: number }>) {
    const key = row.token_address.toLowerCase();
    if (!byToken.has(key)) byToken.set(key, Number(row.amount ?? 0));
  }
  const addresses = [...byToken.keys()];
  if (addresses.length === 0) return [];
  const { data: programs } = await service
    .from("loyalty_programs")
    .select("token_address, name, symbol")
    .in("token_address", addresses);
  const nameBy = new Map<string, { name: string; symbol: string }>();
  for (const p of (programs ?? []) as Array<{ token_address: string; name: string; symbol: string }>) {
    nameBy.set(p.token_address.toLowerCase(), { name: p.name, symbol: p.symbol });
  }
  return addresses
    .filter((addr) => (byToken.get(addr) ?? 0) > 0)
    .slice(0, 20)
    .map((addr) => {
      const program = nameBy.get(addr);
      const label = program ? `${program.name} (${program.symbol})` : addr;
      return `- ${label}: ${amt(byToken.get(addr) ?? 0)}`;
    });
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
