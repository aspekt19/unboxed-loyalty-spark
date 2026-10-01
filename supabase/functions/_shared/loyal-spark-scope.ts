/**
 * Loyal Spark–only scope for protocol-paid OpenServ / chat-bridge.
 * Off-topic must never call tools or burn OpenServ quota.
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

const ALLOW = [
  /\bloyal\s*spark\b/i,
  /\bloyalty\b/i,
  /программ/i,
  /\breward/i,
  /\bvoucher/i,
  /ваучер/i,
  /\bmint\b/i,
  /\bcashback\b/i,
  /\bmcp\b/i,
  /\bx402\b/i,
  /\bcertificate/i,
  /сертификат/i,
  /\bmerchant/i,
  /мерчант/i,
  /\bbalance\b/i,
  /баланс/i,
  /\bp2p\b/i,
  /\bescrow\b/i,
  /\bagent[_ ]?api\b/i,
  /\breport\b/i,
  /\banalytics\b/i,
  /\bcustomer/i,
  /погашен/i,
  /лояльн/i,
  /\boffer/i,
  /оффер/i,
  /\btier\b/i,
  /\bredeem/i,
  /обмен/i,
  /начисл/i,
  /магазин/i,
  /\bstores?\b/i,
  /\bshops?\b/i,
  /\btokens?\b/i,
  /токен/i,
  /балл|балы/i,
  /заработ/i,
  /потрат/i,
  /\bearn\b/i,
  /\bspend\b/i,
  /\bpoints?\b/i,
  /\bprograms?\b/i,
  /гайд/i,
  /\bguides?\b/i,
  /инструкц/i,
  /\bfaq\b/i,
  /\bbilling\b/i,
  /биллинг/i,
  /\bportal\b/i,
  /портал/i,
  /\bhow to\b/i,
  /как (созда|польз|найти|откры|подключ|работает)/i,
];

/** Shopper/merchant asking for their own programs, stores, or balances. */
export function asksForOwnLoyaltyList(text: string): boolean {
  return /магазин|stores?\b|shops?\b|какие у меня|what do i have|мои программ|my programs|my stores|my merchants|available to me|мои токен|my tokens|мои балл|my points|мой баланс|my balance/i
    .test(text);
}

export const LOYAL_SPARK_REFUSAL =
  "I only help with Loyal Spark: loyalty programs, rewards, vouchers, certificates, balances, and agent APIs on Base. I can't help with that.";

export function isLoyalSparkScoped(text: string): boolean {
  const t = String(text || "").trim();
  if (!t) return false;
  if (DENY.some((re) => re.test(t))) return false;
  return ALLOW.some((re) => re.test(t));
}
