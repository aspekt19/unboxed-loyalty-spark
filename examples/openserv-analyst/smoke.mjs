/**
 * Stage A smoke: Loyal Spark MCP auth + scope guard.
 * Protocol-paid OpenServ must stay on-product — see isLoyalSparkScoped().
 */

const MCP_URL = process.env.LOYAL_SPARK_MCP_URL || "https://api.loyalspark.online/loyalty-mcp";
const API_KEY = process.env.LOYAL_SPARK_API_KEY || "";

/** Returns false for off-topic prompts that must not burn OpenServ / MCP quota. */
export function isLoyalSparkScoped(text) {
  const t = String(text || "").toLowerCase().trim();
  if (!t) return false;

  const deny = [
    /\bweather\b/,
    /\bпогод/,
    /\bnews\b/,
    /\bновост/,
    /\bhomework\b/,
    /\bдомашн/,
    /\bjoke\b/,
    /\bанекдот/,
    /\bwho won the\b/,
    /\bprice of (btc|eth|bitcoin|ethereum)\b/,
    /\bjust chat\b/,
    /\bрасскажи (анекдот|сказку)\b/,
  ];
  if (deny.some((re) => re.test(t))) return false;

  const allow = [
    /\bloyal\s*spark\b/,
    /\bloyalty\b/,
    /программ/,
    /\breward/,
    /\bvoucher/,
    /ваучер/,
    /\bmint\b/,
    /\bcashback\b/,
    /\bmcp\b/,
    /\bx402\b/,
    /\bcertificate/,
    /сертификат/,
    /\bmerchant/,
    /мерчант/,
    /\bbalance\b/,
    /баланс/,
    /\bp2p\b/,
    /\bescrow\b/,
    /\bagent[_ ]?api\b/,
    /\breport\b/,
    /\banalytics\b/,
    /\bcustomer/,
    /погашен/,
    /лояльн/,
    /магазин/,
    /\bstores?\b/,
    /\bshops?\b/,
    /\btokens?\b/,
    /токен/,
    /балл|балы/,
    /заработ/,
    /потрат/,
    /\bearn\b/,
    /\bspend\b/,
    /\bpoints?\b/,
    /\bprograms?\b/,
    /гайд/,
    /\bguides?\b/,
    /инструкц/,
    /\bfaq\b/,
    /\bbilling\b/,
    /биллинг/,
    /\bportal\b/,
    /портал/,
    /\bhow to\b/,
    /как (созда|польз|найти|откры|подключ|работает)/,
  ];
  return allow.some((re) => re.test(t));
}

const REFUSAL =
  "I only help with Loyal Spark: loyalty programs, rewards, vouchers, certificates, balances, and agent APIs on Base. I can't help with that.";

async function mcpCall(name, args = {}) {
  const res = await fetch(MCP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name, arguments: args },
    }),
  });
  const json = await res.json();
  return { status: res.status, json };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  console.log("1) Scope guard unit checks…");
  assert(!isLoyalSparkScoped("What's the weather in Moscow?"), "weather must be denied");
  assert(!isLoyalSparkScoped("Tell me a joke"), "joke must be denied");
  assert(isLoyalSparkScoped("List loyalty programs and mint volume"), "loyalty query must be allowed");
  assert(isLoyalSparkScoped("Сколько ваучеров погашено?"), "RU product query must be allowed");
  assert(isLoyalSparkScoped("Какие магазины мне доступны?"), "RU stores query must be allowed");
  assert(isLoyalSparkScoped("Which stores are available to me?"), "EN stores query must be allowed");
  assert(!isLoyalSparkScoped("Привет, как дела?"), "small talk must be denied");
  assert(isLoyalSparkScoped("Где гайд для мерчанта?"), "RU guide query must be allowed");
  assert(isLoyalSparkScoped("How to create a loyalty program?"), "how-to must be allowed");
  assert(isLoyalSparkScoped("Как заработать балы?"), "RU earn typo must be allowed");
  assert(isLoyalSparkScoped("как потратить балы?"), "RU spend typo must be allowed");
  console.log("   off-topic refusal copy:", REFUSAL);

  if (!API_KEY || API_KEY.includes("replace_me")) {
    console.log("2) Skipping live MCP (set LOYAL_SPARK_API_KEY in .env).");
    console.log("OK — scope guard passed.");
    return;
  }

  console.log("2) Live MCP get_my_profile…");
  const { status, json } = await mcpCall("get_my_profile");
  assert(status === 200, `HTTP ${status}`);
  const text = json?.result?.content?.[0]?.text || JSON.stringify(json);
  assert(!/not authenticated/i.test(text), `auth failed: ${text}`);
  console.log("   profile ok:", text.slice(0, 200));
  console.log("OK — Stage A smoke passed.");
}

main().catch((err) => {
  console.error("FAIL:", err.message || err);
  process.exit(1);
});
