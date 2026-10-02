/**
 * Merchant Concierge: deterministic list/count replies (parity with shopper facts-first).
 * Writes (mint, create reward, deploy) stay as portal click-paths — confirm in UI.
 */

type Db = { from: (table: string) => any };

type ChatTurn = { role: string; content: string };

function amt(n: number): string {
  if (!Number.isFinite(n)) return "0";
  const rounded = Math.round(n * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

export function wantsCountOnly(text: string): boolean {
  return /сколько|how\s+many|число|количество|count\b|не\s+перечисл|без\s+списк|только\s+(число|цифр)/i.test(text);
}

function isShortFollowUp(text: string): boolean {
  const t = text.trim();
  if (!t || t.length > 120) return false;
  return (
    wantsCountOnly(t) ||
    /^(покажи|перечисл|выпиши|list(\s+them)?|show(\s+them)?|и\??|а\??|and\??|them|их|этих|эти|все|all(\s+of\s+them)?|ещё|еще|more)$/i.test(t)
  );
}

export type MerchantVoucherFilter = "all" | "active" | "inactive" | "used";

export function merchantVoucherFilter(text: string): MerchantVoucherFilter {
  if (/использован|\bused\b/i.test(text) && !/не\s*актив|неактивн|истек|expired|inactive/i.test(text)) {
    return "used";
  }
  if (/не\s*актив|неактивн|истек|expired|inactive/i.test(text)) return "inactive";
  if (
    /активирован|\bactive\b|активн(?!о)/i.test(text) &&
    !/не\s*актив|неактивн/i.test(text)
  ) {
    return "active";
  }
  return "all";
}

export function asksAboutMerchantPrograms(text: string): boolean {
  if (isMerchantHowTo(text)) return false;
  return /программ|мои?\s+токен|loyalty\s+program|list\s+program|какие\s+програм|статус\s+програм|cashback|points_per|B20/i.test(
    text,
  );
}

export function asksAboutMerchantRewards(text: string): boolean {
  if (asksAboutMerchantVouchers(text)) return false;
  return /наград|\brewards?\b|список\s+наград|какие\s+наград|созданн.{0,20}наград/i.test(text);
}

export function asksAboutMerchantVouchers(text: string): boolean {
  return /ваучер|voucher/i.test(text);
}

export function asksAboutMerchantCertificates(text: string): boolean {
  return /сертификат|gift\s+cert|certificate/i.test(text);
}

/** How-to questions ("как заминтить", "how do I create a program") go to SERV + PRODUCT_MAP, not history lists. */
function isMerchantHowTo(text: string): boolean {
  return /(^|\s)(как|каким образом)\s|\bhow\s+(do|to|can|should)\b|создать|create\s|заминтить|deploy/i.test(text);
}

export function asksAboutMerchantMints(text: string): boolean {
  if (isMerchantHowTo(text)) return false;
  return /минт|mint|начисл|выдал.{0,20}балл|recent\s+mint|последн.{0,20}минт/i.test(text);
}

export function conversationAboutMerchantPrograms(messages: ChatTurn[], lastUser: string): boolean {
  if (asksAboutMerchantPrograms(lastUser)) return true;
  if (!isShortFollowUp(lastUser)) return false;
  for (const m of messages.slice(0, -1).reverse().slice(0, 24)) {
    if (asksAboutMerchantPrograms(m.content) || /Programs \(|Ваши программы/i.test(m.content)) {
      return true;
    }
  }
  return false;
}

export function conversationAboutMerchantRewards(messages: ChatTurn[], lastUser: string): boolean {
  if (asksAboutMerchantRewards(lastUser)) return true;
  if (!isShortFollowUp(lastUser)) return false;
  if (conversationAboutMerchantVouchers(messages, lastUser)) return false;
  for (const m of messages.slice(0, -1).reverse().slice(0, 24)) {
    if (asksAboutMerchantRewards(m.content) || /Merchant rewards|Награды магазина/i.test(m.content)) {
      return true;
    }
  }
  return false;
}

export function conversationAboutMerchantVouchers(messages: ChatTurn[], lastUser: string): boolean {
  if (asksAboutMerchantVouchers(lastUser)) return true;
  if (!isShortFollowUp(lastUser)) return false;
  for (const m of messages.slice(0, -1).reverse().slice(0, 24)) {
    if (asksAboutMerchantVouchers(m.content)) return true;
    const title = m.content.split("\n").slice(0, 2).join("\n");
    if (/Ваучеры магазина|Merchant vouchers/i.test(title)) return true;
  }
  return false;
}

export function resolveMerchantVoucherFilter(
  messages: ChatTurn[],
  lastUser: string,
): MerchantVoucherFilter {
  const fromLast = merchantVoucherFilter(lastUser);
  if (fromLast !== "all") return fromLast;
  for (const m of [...messages].reverse().slice(0, 24)) {
    if (m.role === "user") {
      const f = merchantVoucherFilter(m.content);
      if (f !== "all") return f;
      if (asksAboutMerchantVouchers(m.content)) return "all";
      continue;
    }
    const title = m.content.split("\n").slice(0, 2).join("\n");
    if (/неактивн|inactive \(expired/i.test(title)) return "inactive";
    if (/использованн|used/i.test(title) && /ваучер|voucher/i.test(title)) return "used";
    if (/активн|active/i.test(title) && /ваучер|voucher/i.test(title) && !/неактив/i.test(title)) {
      return "active";
    }
  }
  return "all";
}

const LIST_CAP = 80;

export async function merchantProgramsReply(
  service: Db,
  wallet: string,
  question: string,
): Promise<{ reply: string; source: "merchant_programs" }> {
  const ru = /[а-яё]/i.test(question);
  const countOnly = wantsCountOnly(question);
  const { data, error, count } = await service
    .from("loyalty_programs")
    .select("name, symbol, status, cashback_rate, points_per_dollar, token_address", { count: "exact" })
    .eq("merchant_address", wallet)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) {
    console.error("[concierge-merchant] programs", error);
    return {
      source: "merchant_programs",
      reply: ru ? "Не удалось загрузить программы." : "Could not load programs.",
    };
  }
  const rows = (data ?? []) as Array<{
    name: string;
    symbol: string;
    status: string;
    cashback_rate: number;
    points_per_dollar: number;
    token_address: string;
  }>;
  const total = count ?? rows.length;
  if (total === 0) {
    return {
      source: "merchant_programs",
      reply: ru
        ? `Кошелёк ${wallet}.\nПрограмм пока нет. Создайте в https://loyalspark.online/merchant?tab=programs`
        : `Wallet ${wallet}.\nNo programs yet. Create one at https://loyalspark.online/merchant?tab=programs`,
    };
  }
  if (countOnly) {
    return {
      source: "merchant_programs",
      reply: ru
        ? `Кошелёк ${wallet}.\nПрограмм: ${total}.`
        : `Wallet ${wallet}.\nPrograms: ${total}.`,
    };
  }
  const show = rows.slice(0, LIST_CAP);
  const lines = show.map(
    (p) =>
      `• ${p.name} (${p.symbol}) [${p.status}] cashback ${p.cashback_rate}% · ${p.points_per_dollar} pts/$1 · ${p.token_address}`,
  );
  const more = total > show.length
    ? (ru ? `\nПоказаны ${show.length} из ${total}.` : `\nShowing ${show.length} of ${total}.`)
    : "";
  return {
    source: "merchant_programs",
    reply: ru
      ? `Кошелёк ${wallet}.\nВаши программы. Всего ${total}:\n${lines.join("\n")}${more}\nMint/earn — внутри выбранной программы на ?tab=programs.`
      : `Wallet ${wallet}.\nYour programs. Total ${total}:\n${lines.join("\n")}${more}\nMint/earn is inside the selected program on ?tab=programs.`,
  };
}

export async function merchantRewardsReply(
  service: Db,
  wallet: string,
  question: string,
): Promise<{ reply: string; source: "merchant_rewards" }> {
  const ru = /[а-яё]/i.test(question);
  const countOnly = wantsCountOnly(question);
  const activeOnly = /активн|active only|is_active/i.test(question) && !/не\s*актив|inactive/i.test(question);
  let q = service
    .from("rewards")
    .select("name, cost, is_active, token_address", { count: "exact" })
    .eq("merchant_address", wallet)
    .order("cost", { ascending: true })
    .limit(400);
  if (activeOnly) q = q.eq("is_active", true);
  const { data, error, count } = await q;
  if (error) {
    console.error("[concierge-merchant] rewards", error);
    return {
      source: "merchant_rewards",
      reply: ru ? "Не удалось загрузить награды." : "Could not load rewards.",
    };
  }
  const rows = (data ?? []) as Array<{
    name: string;
    cost: number;
    is_active: boolean;
    token_address: string;
  }>;
  const total = count ?? rows.length;
  if (total === 0) {
    return {
      source: "merchant_rewards",
      reply: ru
        ? `Кошелёк ${wallet}.\nНаград нет. Создайте на https://loyalspark.online/merchant?tab=rewards`
        : `Wallet ${wallet}.\nNo rewards. Create at https://loyalspark.online/merchant?tab=rewards`,
    };
  }
  if (countOnly) {
    return {
      source: "merchant_rewards",
      reply: ru
        ? `Кошелёк ${wallet}.\nНаград: ${total}.`
        : `Wallet ${wallet}.\nRewards: ${total}.`,
    };
  }
  const show = rows.slice(0, LIST_CAP);
  const lines = show.map(
    (r) =>
      `• ${r.name} — ${amt(Number(r.cost))} pts [${r.is_active ? "active" : "inactive"}]`,
  );
  const more = total > show.length
    ? (ru ? `\nПоказаны ${show.length} из ${total}.` : `\nShowing ${show.length} of ${total}.`)
    : "";
  return {
    source: "merchant_rewards",
    reply: ru
      ? `Кошелёк ${wallet}.\nНаграды магазина. Всего ${total}:\n${lines.join("\n")}${more}`
      : `Wallet ${wallet}.\nMerchant rewards. Total ${total}:\n${lines.join("\n")}${more}`,
  };
}

export async function merchantVouchersReply(
  service: Db,
  wallet: string,
  question: string,
  opts?: { status?: MerchantVoucherFilter; countOnly?: boolean },
): Promise<{ reply: string; source: "merchant_vouchers" }> {
  const ru = /[а-яё]/i.test(question);
  const filter = opts?.status ?? merchantVoucherFilter(question);
  const countOnly = opts?.countOnly ?? wantsCountOnly(question);

  let countQ = service
    .from("vouchers")
    .select("id", { count: "exact", head: true })
    .eq("merchant_address", wallet);
  if (filter === "active") countQ = countQ.eq("status", "active");
  if (filter === "inactive") countQ = countQ.eq("status", "expired");
  if (filter === "used") countQ = countQ.eq("status", "used");
  const { count, error: countErr } = await countQ;
  if (countErr) {
    console.error("[concierge-merchant] voucher count", countErr);
    return {
      source: "merchant_vouchers",
      reply: ru ? "Не удалось загрузить ваучеры." : "Could not load vouchers.",
    };
  }
  const total = count ?? 0;
  const label =
    filter === "inactive"
      ? (ru ? "неактивных (expired)" : "inactive (expired)")
      : filter === "used"
      ? (ru ? "использованных" : "used")
      : filter === "active"
      ? (ru ? "активных" : "active")
      : (ru ? "всего" : "in total");

  if (total === 0) {
    return {
      source: "merchant_vouchers",
      reply: ru
        ? `Кошелёк ${wallet}.\nСейчас нет ${label} ваучеров.`
        : `Wallet ${wallet}.\nNo ${label} vouchers.`,
    };
  }
  if (countOnly) {
    return {
      source: "merchant_vouchers",
      reply: ru
        ? `Кошелёк ${wallet}.\nВаучеров ${label}: ${total}.`
        : `Wallet ${wallet}.\n${label} vouchers: ${total}.`,
    };
  }

  let listQ = service
    .from("vouchers")
    .select("code, reward_name, status, token_symbol, cost, activated_at")
    .eq("merchant_address", wallet)
    .order("activated_at", { ascending: false })
    .limit(LIST_CAP);
  if (filter === "active") listQ = listQ.eq("status", "active");
  if (filter === "inactive") listQ = listQ.eq("status", "expired");
  if (filter === "used") listQ = listQ.eq("status", "used");
  const { data, error } = await listQ;
  if (error) {
    console.error("[concierge-merchant] voucher list", error);
    return {
      source: "merchant_vouchers",
      reply: ru ? "Не удалось загрузить ваучеры." : "Could not load vouchers.",
    };
  }
  const rows = (data ?? []) as Array<{
    code?: string;
    reward_name: string;
    status: string;
    token_symbol: string;
    cost: number;
    activated_at: string;
  }>;
  const lines = rows.map((v) => {
    const code = v.code ? ` ${v.code}` : "";
    return `• ${v.reward_name}${code} [${v.status}] — ${amt(Number(v.cost))} ${v.token_symbol} (${v.activated_at})`;
  });
  const more = total > rows.length
    ? (ru
      ? `\nПоказаны ${rows.length} из ${total}. Спросите «сколько … ваучеров» для одного числа.`
      : `\nShowing ${rows.length} of ${total}. Ask “how many … vouchers” for just the number.`)
    : "";
  return {
    source: "merchant_vouchers",
    reply: ru
      ? `Кошелёк ${wallet}.\nВаучеры магазина (${label}). Всего ${total}, новые сверху:\n${lines.join("\n")}${more}`
      : `Wallet ${wallet}.\nMerchant vouchers (${label}). Total ${total}, newest first:\n${lines.join("\n")}${more}`,
  };
}

export async function merchantCertificatesReply(
  service: Db,
  wallet: string,
  question: string,
): Promise<{ reply: string; source: "merchant_certificates" }> {
  const ru = /[а-яё]/i.test(question);
  const countOnly = wantsCountOnly(question);
  const { data, error, count } = await service
    .from("gift_certificates")
    .select("title, status, token_amount, code", { count: "exact" })
    .eq("merchant_address", wallet)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) {
    console.error("[concierge-merchant] certs", error);
    return {
      source: "merchant_certificates",
      reply: ru ? "Не удалось загрузить сертификаты." : "Could not load certificates.",
    };
  }
  const rows = (data ?? []) as Array<{
    title: string;
    status: string;
    token_amount: number;
    code?: string;
  }>;
  const total = count ?? rows.length;
  if (total === 0) {
    return {
      source: "merchant_certificates",
      reply: ru
        ? `Кошелёк ${wallet}.\nСертификатов нет. Создайте на ?tab=certificates`
        : `Wallet ${wallet}.\nNo gift certificates. Create on ?tab=certificates`,
    };
  }
  if (countOnly) {
    return {
      source: "merchant_certificates",
      reply: ru
        ? `Кошелёк ${wallet}.\nСертификатов: ${total}.`
        : `Wallet ${wallet}.\nGift certificates: ${total}.`,
    };
  }
  const show = rows.slice(0, LIST_CAP);
  const lines = show.map(
    (c) => `• ${c.title}${c.code ? ` ${c.code}` : ""} [${c.status}] ${amt(Number(c.token_amount))}`,
  );
  const more = total > show.length
    ? (ru ? `\nПоказаны ${show.length} из ${total}.` : `\nShowing ${show.length} of ${total}.`)
    : "";
  return {
    source: "merchant_certificates",
    reply: ru
      ? `Кошелёк ${wallet}.\nПодарочные сертификаты. Всего ${total}:\n${lines.join("\n")}${more}`
      : `Wallet ${wallet}.\nGift certificates. Total ${total}:\n${lines.join("\n")}${more}`,
  };
}

export async function merchantMintsReply(
  service: Db,
  wallet: string,
  question: string,
): Promise<{ reply: string; source: "merchant_mints" }> {
  const ru = /[а-яё]/i.test(question);
  const countOnly = wantsCountOnly(question);
  const { data, error } = await service
    .from("token_mint_history")
    .select("token_symbol, amount, recipient_address, created_at")
    .eq("merchant_address", wallet)
    .order("created_at", { ascending: false })
    .limit(LIST_CAP);
  if (error) {
    console.error("[concierge-merchant] mints", error);
    return {
      source: "merchant_mints",
      reply: ru ? "Не удалось загрузить историю mint." : "Could not load mint history.",
    };
  }
  const rows = (data ?? []) as Array<{
    token_symbol: string;
    amount: number;
    recipient_address: string;
    created_at: string;
  }>;
  if (rows.length === 0) {
    return {
      source: "merchant_mints",
      reply: ru
        ? `Кошелёк ${wallet}.\nЗаписей mint пока нет. Mint — внутри программы на ?tab=programs.`
        : `Wallet ${wallet}.\nNo mint history yet. Mint inside a program on ?tab=programs.`,
    };
  }
  if (countOnly) {
    return {
      source: "merchant_mints",
      reply: ru
        ? `Кошелёк ${wallet}.\nПоказаны последние ${rows.length} mint (окно списка).`
        : `Wallet ${wallet}.\nShowing the latest ${rows.length} mints (list window).`,
    };
  }
  const lines = rows.map(
    (m) =>
      `• ${amt(Number(m.amount))} ${m.token_symbol} → ${m.recipient_address} (${m.created_at})`,
  );
  return {
    source: "merchant_mints",
    reply: ru
      ? `Кошелёк ${wallet}.\nПоследние mint (новые сверху):\n${lines.join("\n")}`
      : `Wallet ${wallet}.\nRecent mints (newest first):\n${lines.join("\n")}`,
  };
}
