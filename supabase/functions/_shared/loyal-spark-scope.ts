/**
 * Loyal Spark–only scope for protocol-paid OpenServ / chat-bridge.
 * Off-topic and small talk never call the model.
 * Anything else is allowed through: the model reads the question, not a phrase list.
 */

const DENY = [
  /\bweather\b/i,
  /погод/i,
  /\bnews\b/i,
  /новост/i,
  /\bhomework\b/i,
  /домашн/i,
  /\bjoke\b/i,
  /анекдот/i,
  /\bwho won the\b/i,
  /\bprice of (btc|eth|bitcoin|ethereum)\b/i,
  /\bjust chat\b/i,
  /расскажи (анекдот|сказку)/i,
];

export const LOYAL_SPARK_REFUSAL =
  "I only help with Loyal Spark: loyalty programs, rewards, vouchers, certificates, balances, and agent APIs on Base. I can't help with that.";

/** Greeting with no product question. "Привет, как дела?" stays here. */
export function isSmallTalk(text: string): boolean {
  const t = text
    .trim()
    .toLowerCase()
    .replace(/[!?.…]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!t) return true;
  if (/^(привет|здравствуйте|здравствуй|добрый день|добрый вечер|доброе утро|хай|hello|hi|hey|yo)$/.test(t)) {
    return true;
  }
  if (/^(как дела|как ты|how are you|whats up|what's up)$/.test(t)) return true;
  if (/^(привет|hello|hi|hey)[, ]+(как дела|как ты|how are you)$/.test(t)) return true;
  return false;
}

export function isLoyalSparkScoped(text: string): boolean {
  const t = String(text || "").trim();
  if (!t) return false;
  if (isSmallTalk(t)) return false;
  if (DENY.some((re) => re.test(t))) return false;
  return true;
}
