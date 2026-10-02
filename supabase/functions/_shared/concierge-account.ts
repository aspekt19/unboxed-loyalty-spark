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
  return shopperContext(service, wallet, question);
}

function asksAboutLastSpend(text: string): boolean {
  // Keep in sync with concierge-redeem.asksAboutLastSpend (avoid stealing redeem intents).
  if (/ваучер|voucher|redeem|активир|получить\s+ваучер|потратить\s+(балл|очк|points)/i.test(text)) {
    return false;
  }
  return /списан|списали|списани|just\s+used|just\s+spent|which\s+block|каком\s+блоке|последн(ее|яя)\s+списа|last\s+spend|last\s+transfer/i
    .test(text);
}

async function shopperContext(service: Db, wallet: string, question: string): Promise<string> {
  if (asksAboutLastSpend(question)) return lastSpendContext(service, wallet);
  const [vouchersRes, certsRes, offersRes] = await Promise.all([
    service.from("vouchers").select("reward_name, status, token_symbol, token_address, cost, activated_at").ilike("customer_address", wallet).order("activated_at", { ascending: false }).limit(5),
    service.from("gift_certificates").select("title, status, token_symbol, token_amount").ilike("redeemed_by", wallet).limit(10),
    service.from("marketplace_offers").select("status, offer_amount, request_amount").ilike("creator_address", wallet).eq("status", "active").limit(8),
  ]);

  const voucherRows = (vouchersRes.data ?? []) as Array<{
    reward_name: string;
    status: string;
    token_symbol: string;
    token_address: string | null;
    cost: number;
    activated_at: string;
  }>;
  const portal = await portalFromExplorer(service, wallet, voucherRows.map((v) => v.token_address ?? ""));
  const askedTx = await askedTxLine(question);
  const spendSection = portal.status === "failed"
    ? "Explorer transfers: lookup failed. Do not claim that no transfer exists."
    : lines("Explorer transfers for this wallet, newest first. sent is a spend. Each row is one loyalty-token transfer from the Base explorer, with block and tx hash", portal.transfers);

  const vouchers = voucherRows
    .map((v) => `- ${v.activated_at}: spent ${amt(Number(v.cost))} ${v.token_symbol} on ${v.reward_name} [${v.status}]`);
  const certs = ((certsRes.data ?? []) as Array<{ title: string; status: string; token_symbol: string | null; token_amount: number }>)
    .map((c) => `- ${c.title} [${c.status}] ${amt(c.token_amount)} ${c.token_symbol ?? ""}`.trim());
  const offers = ((offersRes.data ?? []) as Array<{ status: string; offer_amount: number; request_amount: number }>)
    .map((o) => `- P2P ${o.status}: offer ${amt(o.offer_amount)} for ${amt(o.request_amount)}`);

  return [
    `Wallet ${wallet}. This is the signed-in shopper. Name this address in the answer. Do not ask them to send it again.`,
    lines("Loyalty balances, same list as the customer portal (explorer token list, loyalty programs only)", portal.balances),
    spendSection,
    askedTx ? `Transaction the user named, read from the Base receipt:\n${askedTx}` : "Transaction the user named: none",
    lines("Recent reward redemptions, newest first. A voucher row is not the block number", vouchers),
    lines("Gift certificates claimed", certs),
    lines("Open P2P offers they created", offers),
  ].join("\n");
}

async function lastSpendContext(service: Db, wallet: string): Promise<string> {
  try {
    const { loadLastLoyaltySpend } = await import("./recipient-onchain-balances.ts");
    const spend = await Promise.race([
      loadLastLoyaltySpend(service, wallet),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("spend timeout")), 12_000)),
    ]);
    if (!spend) return `Wallet ${wallet}.\nLast loyalty spend: none`;
    return [
      `Wallet ${wallet}.`,
      `Last loyalty spend: ${amt(spend.amount)} ${spend.label} [${spend.standard}] | block ${spend.blockNumber} | tx ${spend.txHash} | https://basescan.org/tx/${spend.txHash}`,
    ].join("\n");
  } catch (err) {
    console.error("[concierge-account] last spend", err);
    return `Wallet ${wallet}.\nLast loyalty spend: lookup failed`;
  }
}

async function portalFromExplorer(
  service: Db,
  wallet: string,
  extraTokens: string[],
): Promise<{ balances: string[]; transfers: string[]; status: "ok" | "failed" }> {
  try {
    const { loadLoyaltyExplorerView } = await import("./recipient-onchain-balances.ts");
    const view = await Promise.race([
      loadLoyaltyExplorerView(service, wallet, extraTokens),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("explorer timeout")), 18_000)),
    ]);
    return {
      status: "ok",
      balances: view.balances.map((row) => `- ${row.label}: ${amt(row.amount)}`),
      transfers: view.transfers.map((row) =>
        `- block ${row.blockNumber} tx ${row.txHash}: ${row.direction} ${amt(row.amount)} ${row.label} [${row.standard}]. https://basescan.org/tx/${row.txHash}`
      ),
    };
  } catch (err) {
    console.error("[concierge-account] explorer", err);
    return { balances: [], transfers: [], status: "failed" };
  }
}

async function askedTxLine(question: string): Promise<string> {
  const match = question.match(/0x[a-fA-F0-9]{64}/);
  if (!match) return "";
  try {
    const { loadTxReceiptBlock } = await import("./recipient-onchain-balances.ts");
    const receipt = await Promise.race([
      loadTxReceiptBlock(match[0]),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("receipt timeout")), 4_000)),
    ]);
    if (!receipt) return "";
    return `- block ${receipt.blockNumber} status ${receipt.status} tx ${receipt.txHash}. https://basescan.org/tx/${receipt.txHash}`;
  } catch (err) {
    console.error("[concierge-account] receipt", err);
    return "";
  }
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
