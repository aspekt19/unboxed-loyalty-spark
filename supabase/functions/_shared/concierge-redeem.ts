/**
 * Shopper Concierge redeem: list affordable rewards, prepare transfer calldata.
 * Signing stays in the browser (Privy / wagmi). Voucher creation uses verify-voucher.
 */

import { prepareHolderLoyaltyTransfer } from "./recipient-prepare-transfer.ts";

export type RedeemableReward = {
  id: string;
  name: string;
  description: string;
  cost: number;
  token_address: string;
  token_symbol: string;
  program_name: string;
  merchant_address: string;
  balance: number;
};

export type ConfirmRedeemAction = {
  type: "confirm_redeem";
  reward: RedeemableReward;
  transfer: {
    to: string;
    data: string;
    value: "0x0";
    chain_id: 8453;
  };
};

export type PickRewardAction = {
  type: "pick_reward";
  rewards: RedeemableReward[];
};

export type ConciergeRedeemAction = PickRewardAction | ConfirmRedeemAction;

type Db = { from: (table: string) => any };

export type HeldBalance = {
  tokenAddress: string;
  label: string;
  programName: string;
  symbol: string;
  amount: number;
};

function amt(n: number): string {
  if (!Number.isFinite(n)) return "0";
  const rounded = Math.round(n * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

/**
 * Intent: user wants to ISSUE a voucher (spend points → sign).
 * Must NOT match questions about existing vouchers ("мои ваучеры", "активированные", "неактивные").
 */
export function asksAboutRedeem(text: string): boolean {
  if (asksAboutMyVouchers(text)) return false;
  return /созда(й|ть).{0,80}ваучер|выпуст.{0,40}ваучер|issue\s+(a\s+)?voucher|redeem(\s+a)?\s+reward|redeem(\s+my)?\s+points|обмен(ить)?\s+(балл|наград)|потратить\s+(балл|очк|points)|spend\s+(my\s+)?points|activate\s+(a\s+)?(voucher|reward)|активир(уй|овать)\s+(ваучер|наград)|получить\s+ваучер|хочу\s+ваучер|дай\s+ваучер|сделай\s+ваучер|create\s+(a\s+)?voucher/i
    .test(text);
}

/**
 * Intent: list / status / count of vouchers the shopper already has.
 * "активированные" = already issued vouchers (list), NOT "activate a reward".
 */
export function asksAboutMyVouchers(text: string): boolean {
  return /мои?\s+ваучер|ваучер[аыов]*.{0,40}(не\s*)?актив|активирован|(не\s*)?активн.{0,40}ваучер|неактивн.{0,40}ваучер|неактивир|использованн.{0,40}ваучер|истек.{0,40}ваучер|(какие|список|последн|узнать|покажи|сколько|show|list|count).{0,60}ваучер|my\s+vouchers?|inactive\s+vouchers?|used\s+vouchers?|expired\s+vouchers?|active\s+vouchers?|voucher\s+status|статус\s+ваучер|про\s+.{0,40}ваучер/i
    .test(text);
}

/** Last on-chain spend — must not steal redeem or voucher-list intents. */
export function asksAboutLastSpend(text: string): boolean {
  if (asksAboutRedeem(text) || asksAboutMyVouchers(text)) return false;
  return /списан|списали|списани|just\s+used|just\s+spent|which\s+block|каком\s+блоке|последн(ее|яя|ий)\s+списа|last\s+spend|last\s+transfer|на\s+каком\s+блоке/i
    .test(text);
}

/** Matches customer portal tabs: Active / Inactive(expired) / Used. */
export type VoucherStatusFilter = "all" | "active" | "inactive" | "used";

export function voucherStatusFilter(text: string): VoucherStatusFilter {
  // Used tab — must win before "inactive" (Russian "неактивные" ≠ used).
  if (/использован|\bused\b/i.test(text) && !/не\s*актив|неактивн|истек|expired|inactive/i.test(text)) {
    return "used";
  }
  // Portal "Inactive" = status expired only (not used).
  if (/не\s*актив|неактивн|неактивир|истек|expired|inactive/i.test(text)) {
    return "inactive";
  }
  // "активированные" / "активированы" / active = still usable (status active)
  if (
    /активирован|\bactive\b|активн(?!о)/i.test(text) &&
    !/не\s*актив|неактивн|неактивир/i.test(text)
  ) {
    return "active";
  }
  return "all";
}

// deno-lint-ignore no-explicit-any
function applyVoucherStatusFilter(q: any, filter: VoucherStatusFilter) {
  if (filter === "active") return q.eq("status", "active");
  if (filter === "inactive") return q.eq("status", "expired");
  if (filter === "used") return q.eq("status", "used");
  return q;
}

function voucherFilterLabel(filter: VoucherStatusFilter, ru: boolean): string {
  if (filter === "inactive") return ru ? "неактивных (expired)" : "inactive (expired)";
  if (filter === "used") return ru ? "использованных" : "used";
  if (filter === "active") return ru ? "активных" : "active";
  return ru ? "всего" : "in total";
}

export function wantsVoucherCountOnly(text: string): boolean {
  return /сколько|how\s+many|число|количество|count\b|не\s+перечисл|без\s+списк|только\s+(число|цифр)/i.test(text);
}

type ChatTurn = { role: string; content: string };

/** Short follow-up that continues the previous voucher topic ("только число", "их", "list them"). */
export function isVoucherTopicFollowUp(text: string): boolean {
  const t = text.trim();
  if (!t || t.length > 120) return false;
  if (asksAboutRedeem(text) || asksAboutLastSpend(text)) return false;
  if (asksAboutMyVouchers(text)) return false;
  return (
    wantsVoucherCountOnly(t) ||
    /^(покажи|перечисл|выпиши|list(\s+them)?|show(\s+them)?|и\??|а\??|and\??|them|их|этих|эти|все|all(\s+of\s+them)?|ещё|еще|more)$/i.test(t) ||
    /^(сколько|how\s+many)\s+(их|этих|these|them|всего)?\s*\??$/i.test(t)
  );
}

/** True when this turn is about vouchers, including follow-ups while chat history still has that topic. */
export function conversationAboutVouchers(messages: ChatTurn[], lastUser: string): boolean {
  if (asksAboutMyVouchers(lastUser)) return true;
  if (!isVoucherTopicFollowUp(lastUser)) return false;
  const prior = messages.slice(0, -1).reverse().slice(0, 24);
  for (const m of prior) {
    if (asksAboutMyVouchers(m.content)) return true;
    if (/ваучер|voucher/i.test(m.content)) return true;
  }
  return false;
}

/**
 * Resolve active / inactive / used from the current line, else from recent chat
 * (user questions or assistant voucher replies) until Clear wipes history.
 */
export function resolveVoucherStatusFromHistory(
  messages: ChatTurn[],
  lastUser: string,
): VoucherStatusFilter {
  const fromLast = voucherStatusFilter(lastUser);
  if (fromLast !== "all") return fromLast;

  for (const m of [...messages].reverse().slice(0, 24)) {
    if (m.role === "user") {
      const fromLine = voucherStatusFilter(m.content);
      if (fromLine !== "all") return fromLine;
      // Newest explicit voucher question had no filter ("все мои ваучеры") — keep "all".
      if (asksAboutMyVouchers(m.content)) return "all";
      continue;
    }
    // Assistant: read only the reply title, never the "[used]/[active]" row tags.
    const title = m.content.split("\n").slice(0, 2).join("\n");
    if (/Неактивные ваучеры|Inactive vouchers \(expired/i.test(title)) return "inactive";
    if (/Использованные ваучеры|Used vouchers\./i.test(title)) return "used";
    if (/Активные ваучеры|Active vouchers\./.test(title)) return "active";
    if (/Ваши ваучеры\.|Your vouchers\./i.test(title)) return "all";
  }
  return "all";
}

/** Points / loyalty token balances (portal Loyalty list). */
export function asksAboutBalances(text: string): boolean {
  if (
    asksAboutMyVouchers(text) ||
    asksAboutRedeem(text) ||
    asksAboutLastSpend(text) ||
    asksAboutRewardsList(text)
  ) {
    return false;
  }
  return /балл|баланс|\bpoints?\b|\bbalance\b|сколько у меня|мои токен|loyalty token|holdings|what do i have|что у меня|у меня на кошел|больше всего|the most|highest balance/i
    .test(text);
}

/** List affordable rewards — not “create a voucher now”. */
export function asksAboutRewardsList(text: string): boolean {
  if (asksAboutMyVouchers(text) || asksAboutRedeem(text) || asksAboutLastSpend(text)) {
    return false;
  }
  return /наград|\brewards?\b|что (могу|можно) (обмен|купить|получить|активир)|affordable|доступн.{0,30}наград|какие наград|список наград|show (me )?(my )?rewards|list (my )?rewards/i
    .test(text);
}

export function conversationAboutBalances(messages: ChatTurn[], lastUser: string): boolean {
  if (asksAboutBalances(lastUser)) return true;
  if (!isVoucherTopicFollowUp(lastUser) && !wantsVoucherCountOnly(lastUser)) return false;
  if (conversationAboutVouchers(messages, lastUser)) return false;
  const prior = messages.slice(0, -1).reverse().slice(0, 24);
  for (const m of prior) {
    if (asksAboutRewardsList(m.content)) return false;
    if (/доступн(ые|ых) наград|Rewards you can afford|Награды, на которые/i.test(m.content)) {
      return false;
    }
  }
  for (const m of prior) {
    if (asksAboutBalances(m.content)) return true;
    if (/Ваши баллы|Your points|Loyalty balances|Программ с балансом|Programs with a balance/i.test(m.content)) {
      return true;
    }
  }
  return false;
}

export function conversationAboutRewards(messages: ChatTurn[], lastUser: string): boolean {
  if (asksAboutRewardsList(lastUser)) return true;
  if (!isVoucherTopicFollowUp(lastUser) && !wantsVoucherCountOnly(lastUser)) return false;
  if (conversationAboutVouchers(messages, lastUser)) return false;
  const prior = messages.slice(0, -1).reverse().slice(0, 24);
  for (const m of prior) {
    if (asksAboutRewardsList(m.content)) return true;
    if (/доступн(ые|ых) наград|Rewards you can afford|Награды, на которые/i.test(m.content)) {
      return true;
    }
  }
  return false;
}

const HOLDINGS_LIST_CAP = 80;

/** Full loyalty balances (same source as portal), no top-8 truncation. */
export async function shopperBalancesReply(
  service: Db,
  wallet: string,
  question: string,
  preloaded?: HeldBalance[] | null,
  opts?: { countOnly?: boolean },
): Promise<{ reply: string; source: "balances" }> {
  const ru = /[а-яё]/i.test(question);
  const countOnly = opts?.countOnly ?? wantsVoucherCountOnly(question);
  let held: HeldBalance[] = [];
  try {
    held = preloaded?.length ? preloaded : await loadHeldLoyaltyBalances(service, wallet);
  } catch (err) {
    console.error("[concierge-redeem] balances reply", err);
    return {
      source: "balances",
      reply: ru
        ? "Не удалось загрузить баллы. Повторите вопрос через минуту."
        : "Could not load balances. Ask again in a moment.",
    };
  }

  const total = held.length;
  if (total === 0) {
    return {
      source: "balances",
      reply: ru
        ? `Кошелёк ${wallet}.\nСейчас нет баллов лояльности. Их начисляет магазин на вкладке Loyalty (QR).`
        : `Wallet ${wallet}.\nNo loyalty points yet. A merchant issues them on the Loyalty tab (QR).`,
    };
  }

  if (countOnly) {
    return {
      source: "balances",
      reply: ru
        ? `Кошелёк ${wallet}.\nПрограмм с балансом: ${total}.`
        : `Wallet ${wallet}.\nPrograms with a balance: ${total}.`,
    };
  }

  const show = held.slice(0, HOLDINGS_LIST_CAP);
  const lines = show.map((b) => `• ${b.programName} (${b.symbol}): ${amt(b.amount)}`);
  const more =
    total > show.length
      ? (ru
        ? `\nПоказаны ${show.length} из ${total} (по убыванию баланса).`
        : `\nShowing ${show.length} of ${total} (highest balance first).`)
      : "";
  return {
    source: "balances",
    reply: ru
      ? `Кошелёк ${wallet}.\nВаши баллы, от большего к меньшему. Всего программ: ${total}:\n${lines.join("\n")}${more}`
      : `Wallet ${wallet}.\nYour points, highest first. Programs: ${total}:\n${lines.join("\n")}${more}`,
  };
}

/** Full affordable rewards list (not capped at 12/24 for display). */
export async function shopperRewardsReply(
  service: Db,
  wallet: string,
  question: string,
  preloaded?: RedeemableReward[] | null,
  opts?: { countOnly?: boolean },
): Promise<{ reply: string; source: "rewards" }> {
  const ru = /[а-яё]/i.test(question);
  const countOnly = opts?.countOnly ?? wantsVoucherCountOnly(question);
  let rewards: RedeemableReward[] = [];
  try {
    rewards = preloaded?.length
      ? preloaded
      : await listRedeemableRewards(service, wallet);
  } catch (err) {
    console.error("[concierge-redeem] rewards reply", err);
    return {
      source: "rewards",
      reply: ru
        ? "Не удалось загрузить награды. Повторите вопрос через минуту."
        : "Could not load rewards. Ask again in a moment.",
    };
  }

  const total = rewards.length;
  if (total === 0) {
    return {
      source: "rewards",
      reply: ru
        ? `Кошелёк ${wallet}.\nСейчас нет наград, на которые хватает баллов. Откройте Loyalty → Rewards.`
        : `Wallet ${wallet}.\nNo rewards you can afford right now. Open Loyalty → Rewards.`,
    };
  }

  if (countOnly) {
    return {
      source: "rewards",
      reply: ru
        ? `Кошелёк ${wallet}.\nДоступных наград (хватает баллов): ${total}.`
        : `Wallet ${wallet}.\nAffordable rewards: ${total}.`,
    };
  }

  const show = rewards.slice(0, HOLDINGS_LIST_CAP);
  const lines = show.map(
    (r) =>
      `• ${r.name} — ${amt(r.cost)} ${r.token_symbol || r.program_name} (баланс ${amt(r.balance)})`,
  );
  const more =
    total > show.length
      ? (ru
        ? `\nПоказаны ${show.length} из ${total}. Скажите «выпусти ваучер» чтобы выбрать.`
        : `\nShowing ${show.length} of ${total}. Say “issue a voucher” to pick one.`)
      : (ru
        ? `\nСкажите «выпусти ваучер», чтобы выбрать и подписать.`
        : `\nSay “issue a voucher” to pick one and sign.`);
  return {
    source: "rewards",
    reply: ru
      ? `Кошелёк ${wallet}.\nНаграды, на которые хватает баллов. Всего ${total}, сначала программы с большим балансом:\n${lines.join("\n")}${more}`
      : `Wallet ${wallet}.\nRewards you can afford. Total ${total}, higher-balance programs first:\n${lines.join("\n")}${more}`,
  };
}

export type SnapshotVoucher = {
  code?: string;
  reward_name: string;
  status: string;
  cost: number;
  token_symbol: string;
  activated_at: string;
};

const VOUCHER_LIST_LIMIT = 40;

/** Load vouchers from DB. Counts are exact (not capped). List shows newest N. */
export async function shopperVoucherHistoryReply(
  service: Db,
  wallet: string,
  question: string,
  _snapshot: SnapshotVoucher[] | null,
  opts?: { status?: VoucherStatusFilter; countOnly?: boolean },
): Promise<{ reply: string; source: "vouchers" }> {
  const ru = /[а-яё]/i.test(question);
  const filter = opts?.status ?? voucherStatusFilter(question);
  const countOnly = opts?.countOnly ?? wantsVoucherCountOnly(question);
  let rows: SnapshotVoucher[] = [];
  let total = 0;

  try {
    let countQ = service
      .from("vouchers")
      .select("id", { count: "exact", head: true })
      .ilike("customer_address", wallet);
    countQ = applyVoucherStatusFilter(countQ, filter);
    const { count, error: countErr } = await countQ;
    if (countErr) throw countErr;
    total = count ?? 0;

    if (!countOnly && total > 0) {
      let q = service
        .from("vouchers")
        .select("code, reward_name, status, token_symbol, cost, activated_at")
        .ilike("customer_address", wallet)
        .order("activated_at", { ascending: false })
        .limit(VOUCHER_LIST_LIMIT);
      q = applyVoucherStatusFilter(q, filter);
      const { data, error } = await q;
      if (error) throw error;
      rows = ((data ?? []) as SnapshotVoucher[]).map((v) => ({ ...v, cost: Number(v.cost) }));
    }
  } catch (err) {
    console.error("[concierge-redeem] voucher history", err);
    return {
      source: "vouchers",
      reply: ru
        ? "Не удалось загрузить ваучеры. Повторите вопрос через минуту."
        : "Could not load vouchers. Ask again in a moment.",
    };
  }

  if (total === 0) {
    const label =
      filter === "inactive"
        ? (ru ? "неактивных ваучеров (expired)" : "inactive vouchers (expired)")
        : filter === "used"
        ? (ru ? "использованных ваучеров" : "used vouchers")
        : filter === "active"
        ? (ru ? "активных ваучеров" : "active vouchers")
        : (ru ? "ваучеров" : "vouchers");
    return {
      source: "vouchers",
      reply: ru
        ? `Кошелёк ${wallet}.\nСейчас нет ${label}.`
        : `Wallet ${wallet}.\nNo ${label} right now.`,
    };
  }

  if (countOnly) {
    const label = voucherFilterLabel(filter, ru);
    return {
      source: "vouchers",
      reply: ru
        ? `Кошелёк ${wallet}.\nВаучеров ${label}: ${total}.`
        : `Wallet ${wallet}.\n${label} vouchers: ${total}.`,
    };
  }

  const lines = rows.map((v) => {
    const code = v.code ? ` ${v.code}` : "";
    return `• ${v.reward_name}${code} [${v.status}] — ${amt(Number(v.cost))} ${v.token_symbol} (${v.activated_at})`;
  });
  const title =
    filter === "inactive"
      ? (ru
        ? `Неактивные ваучеры (expired, как в портале). Всего ${total}, новые сверху:`
        : `Inactive vouchers (expired, same as portal). Total ${total}, newest first:`)
      : filter === "used"
      ? (ru
        ? `Использованные ваучеры. Всего ${total}, новые сверху:`
        : `Used vouchers. Total ${total}, newest first:`)
      : filter === "active"
      ? (ru ? `Активные ваучеры. Всего ${total}, новые сверху:` : `Active vouchers. Total ${total}, newest first:`)
      : (ru ? `Ваши ваучеры. Всего ${total}, новые сверху:` : `Your vouchers. Total ${total}, newest first:`);
  const countHint =
    filter === "used"
      ? (ru ? "сколько использованных ваучеров" : "how many used vouchers")
      : filter === "inactive"
      ? (ru ? "сколько неактивных ваучеров" : "how many inactive vouchers")
      : (ru ? "сколько активных ваучеров" : "how many active vouchers");
  const more =
    total > rows.length
      ? (ru
        ? `\nПоказаны ${rows.length} из ${total}. Спросите «${countHint}» для одного числа.`
        : `\nShowing ${rows.length} of ${total}. Ask “${countHint}” for just the number.`)
      : "";

  return {
    source: "vouchers",
    reply: `${ru ? `Кошелёк ${wallet}.` : `Wallet ${wallet}.`}\n${title}\n${lines.join("\n")}${more}`,
  };
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}

/** Rank request: 1 = highest balance program, 2 = second, … */
export function requestedProgramRank(text: string): number | null {
  const q = normalize(text);
  if (/втор(ой|ым|ая|ую)|second\s+high|2\s*[-.]?\s*(place|highest|самым)/i.test(q)) return 2;
  if (/треть|third\s+high|3\s*[-.]?\s*(place|highest)/i.test(q)) return 3;
  if (/сам(ый|ом|ая|ую)\s+высок|наибольш|больше\s+всего|highest|most\s+points|max(imum)?\s+balanc/i.test(q)) {
    return 1;
  }
  return null;
}

/**
 * Balances the same way the customer portal does: on-chain balanceOf for loyalty programs.
 * Falls back to Blockscout token-balances only if multicall fails — never pulls tokentx history.
 */
export async function loadHeldLoyaltyBalances(service: Db, wallet: string): Promise<HeldBalance[]> {
  try {
    const { loadHolderBalancesFast } = await import("./recipient-onchain-balances.ts");
    const rows = await Promise.race([
      loadHolderBalancesFast(service, wallet),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("balance timeout")), 10_000)),
    ]);
    return rows
      .filter((r): r is typeof r & { program: NonNullable<typeof r.program> } =>
        r.current_balance > 0 && r.program != null
      )
      .map((r) => ({
        tokenAddress: r.token_address,
        label: `${r.program.name} (${r.program.symbol})`,
        programName: r.program.name,
        symbol: r.program.symbol,
        amount: r.current_balance,
      }))
      .sort((a, b) => b.amount - a.amount);
  } catch (err) {
    console.error("[concierge-redeem] multicall balances", err);
  }

  // Explorer balances only (no transfer history — that path was timing out redeem).
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const resp = await fetch(
      `https://base.blockscout.com/api/v2/addresses/${wallet.toLowerCase()}/token-balances`,
      { signal: controller.signal, headers: { accept: "application/json" } },
    );
    const body = await resp.json();
    if (!Array.isArray(body)) throw new Error("explorer token balances");
    const { data, error } = await service
      .from("loyalty_programs")
      .select("token_address, name, symbol")
      .limit(2000);
    if (error) throw error;
    const programBy = new Map(
      ((data ?? []) as Array<{ token_address: string; name: string; symbol: string }>).map((p) => [
        p.token_address.toLowerCase(),
        p,
      ]),
    );
    const out: HeldBalance[] = [];
    for (const row of body as Array<{ value?: string; token?: { address_hash?: string; decimals?: string } }>) {
      const tokenAddress = (row.token?.address_hash ?? "").toLowerCase();
      const program = programBy.get(tokenAddress);
      if (!program) continue;
      const decimals = Number(row.token?.decimals ?? "18");
      const safe = Number.isInteger(decimals) && decimals >= 0 && decimals <= 36 ? decimals : 18;
      let raw = 0n;
      try {
        raw = BigInt(row.value ?? "0");
      } catch {
        continue;
      }
      if (raw <= 0n) continue;
      const amount = Number(raw) / 10 ** safe;
      out.push({
        tokenAddress,
        label: `${program.name} (${program.symbol})`,
        programName: program.name,
        symbol: program.symbol,
        amount,
      });
    }
    return out.sort((a, b) => b.amount - a.amount);
  } finally {
    clearTimeout(timer);
  }
}

export async function listRedeemableRewards(
  service: Db,
  wallet: string,
  opts?: { limit?: number },
): Promise<RedeemableReward[]> {
  return rewardsForHeld(service, await loadHeldLoyaltyBalances(service, wallet), opts);
}

/** Affordable active rewards for an already-loaded balance list (agent-context reuses this). */
export async function rewardsForHeld(
  service: Db,
  heldAll: HeldBalance[],
  opts?: { limit?: number },
): Promise<RedeemableReward[]> {
  const held = heldAll.filter((b) => b.amount > 0);
  if (held.length === 0) return [];

  const tokens = held.map((b) => b.tokenAddress);
  const dbLimit = Math.min(Math.max(opts?.limit ?? 400, 1), 500);
  const { data: rewards, error } = await service
    .from("rewards")
    .select("id, name, description, cost, token_address, merchant_address, is_active")
    .in("token_address", tokens)
    .eq("is_active", true)
    .order("cost", { ascending: true })
    .limit(dbLimit);
  if (error) throw error;

  const byToken = new Map(held.map((b) => [b.tokenAddress.toLowerCase(), b]));
  const out: RedeemableReward[] = [];
  for (const row of (rewards ?? []) as Array<{
    id: string;
    name: string;
    description: string | null;
    cost: number;
    token_address: string;
    merchant_address: string;
    is_active: boolean;
  }>) {
    const bal = byToken.get(row.token_address.toLowerCase());
    if (!bal) continue;
    const cost = Number(row.cost);
    if (!Number.isFinite(cost) || cost <= 0 || bal.amount + 1e-9 < cost) continue;
    out.push({
      id: row.id,
      name: row.name,
      description: (row.description ?? "").slice(0, 240),
      cost,
      token_address: row.token_address.toLowerCase(),
      token_symbol: bal.symbol,
      program_name: bal.programName,
      merchant_address: row.merchant_address.toLowerCase(),
      balance: bal.amount,
    });
  }
  // Prefer higher-balance programs first, then cheaper rewards.
  out.sort((a, b) => b.balance - a.balance || a.cost - b.cost);
  if (opts?.limit != null) return out.slice(0, opts.limit);
  return out;
}

export function matchRewardByText(
  rewards: RedeemableReward[],
  text: string,
): { reward: RedeemableReward | null; filtered: RedeemableReward[] } {
  const q = normalize(text);
  if (!q || rewards.length === 0) return { reward: null, filtered: rewards };

  const rank = requestedProgramRank(text);
  if (rank != null) {
    // rewards already sorted by balance desc; unique programs keep first-seen order
    const orderedTokens: string[] = [];
    for (const r of rewards) {
      if (!orderedTokens.includes(r.token_address)) orderedTokens.push(r.token_address);
    }
    const token = orderedTokens[rank - 1];
    if (!token) return { reward: null, filtered: [] };
    const filtered = rewards.filter((r) => r.token_address === token);
    if (filtered.length === 1) return { reward: filtered[0], filtered };
    return { reward: null, filtered };
  }

  const exact = rewards.find((r) => normalize(r.name) === q);
  if (exact) return { reward: exact, filtered: [exact] };
  const named = rewards.filter((r) => {
    const n = normalize(r.name);
    return n.length >= 3 && q.includes(n);
  });
  if (named.length === 1) return { reward: named[0], filtered: named };
  if (named.length > 1) return { reward: null, filtered: named };
  const byProgram = rewards.filter((r) => {
    const p = normalize(r.program_name);
    const s = normalize(r.token_symbol);
    return (p.length >= 3 && q.includes(p)) || (s.length >= 2 && q.includes(s));
  });
  if (byProgram.length === 1) return { reward: byProgram[0], filtered: byProgram };
  if (byProgram.length > 1) return { reward: null, filtered: byProgram };
  return { reward: null, filtered: rewards };
}

export async function prepareRedeemAction(
  service: Db,
  wallet: string,
  rewardId: string,
): Promise<{ action: ConfirmRedeemAction; reply: string } | { error: string; reply: string }> {
  const { data: reward, error } = await service
    .from("rewards")
    .select("id, name, description, cost, token_address, merchant_address, is_active")
    .eq("id", rewardId)
    .maybeSingle();
  if (error || !reward) {
    return {
      error: "not_found",
      reply: "Награда не найдена. Выберите другую из списка.",
    };
  }
  if (!reward.is_active) {
    return { error: "inactive", reply: "Эта награда сейчас не активна." };
  }

  const list = await listRedeemableRewards(service, wallet);
  const affordable = list.find((r) => r.id === reward.id);
  if (!affordable) {
    return {
      error: "insufficient",
      reply: `Недостаточно баллов для «${reward.name}» (нужно ${amt(Number(reward.cost))}).`,
    };
  }

  const prepared = await prepareHolderLoyaltyTransfer(
    service,
    wallet,
    affordable.token_address,
    affordable.merchant_address,
    affordable.cost,
  );
  if (!prepared.ok) {
    return {
      error: "prepare_failed",
      reply: typeof prepared.body.error === "string"
        ? prepared.body.error
        : "Не удалось подготовить перевод. Попробуйте ещё раз.",
    };
  }
  const calldata = (prepared.body.contract_call as { calldata?: string })?.calldata;
  if (!calldata) {
    return { error: "prepare_failed", reply: "Не удалось подготовить calldata перевода." };
  }

  const action: ConfirmRedeemAction = {
    type: "confirm_redeem",
    reward: affordable,
    transfer: {
      to: affordable.token_address,
      data: calldata,
      value: "0x0",
      chain_id: 8453,
    },
  };

  return {
    action,
    reply: [
      `Подтвердите выпуск ваучера «${affordable.name}».`,
      `Списание: ${amt(affordable.cost)} ${affordable.token_symbol || affordable.program_name}.`,
      `Баланс сейчас: ${amt(affordable.balance)}.`,
      "Нажмите «Подписать и выпустить» — откроется кошелёк. После подтверждения на Base появится код ваучера.",
    ].join("\n"),
  };
}

export async function shopperRedeemIntentReply(
  service: Db,
  wallet: string,
  question: string,
  preloaded?: RedeemableReward[] | null,
): Promise<{ reply: string; action: ConciergeRedeemAction | null; source: "redeem" }> {
  const ru = /[а-яё]/i.test(question);
  let rewards: RedeemableReward[];
  try {
    rewards = preloaded?.length
      ? preloaded
      : await listRedeemableRewards(service, wallet, { limit: 24 });
  } catch (err) {
    console.error("[concierge-redeem] list", err);
    return {
      source: "redeem",
      action: null,
      reply: ru
        ? "Не удалось загрузить награды. Повторите вопрос через минуту."
        : "Could not load rewards. Ask again in a moment.",
    };
  }

  if (rewards.length === 0) {
    return {
      source: "redeem",
      action: null,
      reply: ru
        ? "Сейчас нет наград, на которые хватает ваших баллов. На вкладке Loyalty проверьте баланс и Rewards."
        : "No rewards you can afford right now. Check Loyalty balances and Rewards.",
    };
  }

  const matched = matchRewardByText(rewards, question);
  const pool = matched.filtered.length > 0 ? matched.filtered : rewards;

  if (matched.reward) {
    const prepared = await prepareRedeemAction(service, wallet, matched.reward.id);
    if ("action" in prepared) {
      return {
        source: "redeem",
        action: prepared.action,
        reply: ru
          ? prepared.reply
          : [
              `Confirm voucher “${matched.reward.name}”.`,
              `Spend: ${amt(matched.reward.cost)} ${matched.reward.token_symbol || matched.reward.program_name}.`,
              `Balance now: ${amt(matched.reward.balance)}.`,
              "Tap Sign and issue — your wallet will open. After Base confirms, the voucher code appears here.",
            ].join("\n"),
      };
    }
    return { source: "redeem", action: null, reply: prepared.reply };
  }

  const rank = requestedProgramRank(question);
  const headline = (() => {
    if (rank === 1 && pool.length > 0) {
      return ru
        ? `Программа с наибольшим балансом: ${pool[0].program_name} (${amt(pool[0].balance)} ${pool[0].token_symbol}). Выберите награду:`
        : `Highest balance program: ${pool[0].program_name} (${amt(pool[0].balance)} ${pool[0].token_symbol}). Pick a reward:`;
    }
    if (rank === 2 && pool.length > 0) {
      return ru
        ? `Вторая по балансу: ${pool[0].program_name} (${amt(pool[0].balance)} ${pool[0].token_symbol}). Выберите награду:`
        : `Second-highest balance: ${pool[0].program_name} (${amt(pool[0].balance)} ${pool[0].token_symbol}). Pick a reward:`;
    }
    if (rank != null && pool.length === 0) {
      return ru
        ? "У вас нет столько программ с доступными наградами. Выберите из списка:"
        : "You do not have that many programs with affordable rewards. Pick from the list:";
    }
    return ru
      ? "Доступные награды для вашего кошелька:"
      : "Rewards you can redeem now:";
  })();

  const show = (pool.length > 0 ? pool : rewards).slice(0, 12);
  const lines = show.map(
    (r) => `• ${r.name} — ${amt(r.cost)} ${r.token_symbol || r.program_name} (есть ${amt(r.balance)})`,
  );
  return {
    source: "redeem",
    action: { type: "pick_reward", rewards: show },
    reply: ru
      ? `${headline}\n${lines.join("\n")}\nВыберите награду кнопкой ниже — затем подтвердите подписью.`
      : `${headline}\n${lines.join("\n")}\nPick one below, then confirm with your wallet.`,
  };
}
