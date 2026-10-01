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

async function shopperContext(service: Db, wallet: string, question: string): Promise<string> {
  const [held, vouchersRes, certsRes, offersRes] = await Promise.all([
    shopperBalanceLines(service, wallet),
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
  const [spends, askedTx] = await Promise.all([
    recentSpendLines(service, wallet, [
      ...held.tokenAddresses,
      ...voucherRows.map((v) => v.token_address ?? ""),
    ]),
    askedTxLine(question),
  ]);
  const spendSection = spends.status === "failed"
    ? "Explorer transfers: lookup failed. Do not claim that no transfer exists."
    : lines("Explorer transfers for this wallet, newest first. Already read from the wallet token history on a public Base explorer. A row is included when the token is any loyalty program, even if the wallet no longer holds it. sent is a spend. Do not offer to look this up again", spends.rows);

  const vouchers = voucherRows
    .map((v) => `- ${v.activated_at}: spent ${amt(Number(v.cost))} ${v.token_symbol} on ${v.reward_name} [${v.status}]`);
  const certs = ((certsRes.data ?? []) as Array<{ title: string; status: string; token_symbol: string | null; token_amount: number }>)
    .map((c) => `- ${c.title} [${c.status}] ${amt(c.token_amount)} ${c.token_symbol ?? ""}`.trim());
  const offers = ((offersRes.data ?? []) as Array<{ status: string; offer_amount: number; request_amount: number }>)
    .map((o) => `- P2P ${o.status}: offer ${amt(o.offer_amount)} for ${amt(o.request_amount)}`);

  return [
    `Wallet ${wallet}. This is the signed-in shopper. Name this address in the answer. Do not ask them to send it again.`,
    lines("Loyalty balances, same list as the customer portal (on-chain balance above zero only)", held.lines),
    spendSection,
    askedTx ? `Transaction the user named, read from the Base receipt:\n${askedTx}` : "Transaction the user named: none",
    lines("Recent reward redemptions, newest first. A voucher row is not the block number", vouchers),
    lines("Gift certificates claimed", certs),
    lines("Open P2P offers they created", offers),
  ].join("\n");
}

async function recentSpendLines(
  service: Db,
  wallet: string,
  alsoContracts: string[],
): Promise<{ rows: string[]; status: "ok" | "failed" | "no-tokens" }> {
  try {
    const { loadExplorerLoyaltyTransfers } = await import("./recipient-onchain-balances.ts");
    const rows = await Promise.race([
      loadExplorerLoyaltyTransfers(service, wallet, alsoContracts),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("explorer timeout")), 12_000)),
    ]);
    return {
      status: "ok",
      rows: rows.map((row) =>
        `- block ${row.blockNumber} tx ${row.txHash}: ${row.direction} ${amt(row.amount)} ${row.label} [${row.standard}]. https://basescan.org/tx/${row.txHash}`
      ),
    };
  } catch (err) {
    console.error("[concierge-account] explorer transfers", err);
    return { rows: [], status: "failed" };
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

/** On-chain balances only. A historical mint amount is not what the portal shows. */
async function shopperBalanceLines(
  service: Db,
  wallet: string,
): Promise<{ lines: string[]; tokenAddresses: string[] }> {
  try {
    const { loadHolderBalancesFast } = await import("./recipient-onchain-balances.ts");
    const rows = await Promise.race([
      loadHolderBalancesFast(service, wallet),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("balance timeout")), 8_000)),
    ]);
    const positive = rows
      .filter((row) => row.current_balance > 0)
      .sort((a, b) => b.current_balance - a.current_balance);
    return {
      tokenAddresses: positive.map((row) => row.token_address),
      lines: positive.map((row) => {
        const label = row.program ? `${row.program.name} (${row.program.symbol})` : row.token_address;
        return `- ${label}: ${amt(row.current_balance)}`;
      }),
    };
  } catch (err) {
    console.error("[concierge-account] chain balances", err);
    return {
      tokenAddresses: [],
      lines: ["- on-chain balance read failed. Do not guess amounts from old mints or from another wallet."],
    };
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
