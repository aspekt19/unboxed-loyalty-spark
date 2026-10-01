/**
 * Stage A smoke: Loyal Spark MCP auth + scope guard.
 * Protocol-paid OpenServ must stay on-product — see isLoyalSparkScoped().
 */

const MCP_URL = process.env.LOYAL_SPARK_MCP_URL || "https://api.loyalspark.online/loyalty-mcp";
const API_KEY = process.env.LOYAL_SPARK_API_KEY || "";

function isSmallTalk(text) {
  const t = String(text || "")
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

/** Off-topic and small talk stay local. Every other question reaches the model. */
export function isLoyalSparkScoped(text) {
  const t = String(text || "").trim();
  if (!t || isSmallTalk(t)) return false;
  const deny = [
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
  return !deny.some((re) => re.test(t));
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
  assert(!isLoyalSparkScoped("Как дела?"), "small talk how-are-you must be denied");
  assert(isLoyalSparkScoped("Каких баллов лояльности у меня больше всего?"), "which points are most");
  assert(isLoyalSparkScoped("Каких токенов у меня больше всего?"), "which tokens are most");
  assert(isLoyalSparkScoped("что мне показать на кассе?"), "unlisted wording must still reach the model");
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
