/**
 * OpenServ SERV Reasoning for the in-app Concierge.
 * Same shape AllowLatch used for policy drafting: OpenAI-compatible
 * chat completions, system prompt required, serv_prompt_guard + serv_shadow_agent.
 * Docs: https://docs.openserv.ai/serv-reasoning/tools
 *
 * SERV drafts the reply. Loyal Spark scope (loyal-spark-scope.ts) decides
 * whether the turn is allowed before this call.
 */

const SERV_URL = "https://inference-api.openserv.ai/v1/chat/completions";
const PROMPT_VERSION = "ls-concierge-v5";

const PRODUCT_MAP = `How Loyal Spark works (use this to answer usage questions; do not invent pages):
Loyal Spark is an onchain loyalty protocol on Base (chain 8453). A merchant deploys a B20 loyalty token, customers earn points, rewards are redeemed as vouchers, gift certificates are a separate catalog. P2P escrow offers exist. DEX trading and DeFi yield are not available — do not send users there.

When the user asks how to do something, name the page and the click path, and link the guide. Reply in the user's language. Plain sentences only: no markdown asterisks, and no URLs that are not listed here.

Guides and docs:
- Human guide (tabs inside the page): https://loyalspark.online/guide — Getting Started, For Merchants, For Customers, For AI Agents, FAQ
- Agent onboarding: https://loyalspark.online/for-agents
- Agent skill guides: https://loyalspark.online/.well-known/skills/index.md (00 getting started through 15 payments)
- API reference: https://loyalspark.online/api-docs
- Pricing: https://loyalspark.online/pricing
- Examples: https://loyalspark.online/examples

Merchant portal https://loyalspark.online/merchant
- Home: ?tab=dashboard
- Programs, rewards, certificates: ?tab=programs ?tab=rewards ?tab=certificates
- Customers, marketing: ?tab=customers ?tab=marketing
- Billing, AI agents (lsk_ keys), this assistant, team: ?tab=billing ?tab=agents ?tab=assistant ?tab=team
Create a program under Programs. Mint and earn are inside the selected program. Billing is USDC on Base.

Customer portal https://loyalspark.online/customer
- Loyalty: token balances, rewards, vouchers, certificates
- Discover: find merchants
- Exchange: P2P offers
Sign-in can be email, SMS, Google, or a wallet. Balances belong to the connected wallet.

Agents: merchant key lsk_ on https://api.loyalspark.online/agent-api and MCP https://api.loyalspark.online/loyalty-mcp. Holder key rwk_ on recipient-api and recipient-loyalty-mcp. Pay-per-call is x402 or MPP. Mint fee is loyalty tokens, not USDC.`;

const MERCHANT_SYSTEM = `You are the Loyal Spark merchant assistant on Base (loyalspark.online).

Rulebook A — answer:
Help with loyalty programs, mint and earn (describe the portal step; never claim a transaction was sent), rewards, vouchers, gift certificates, customers, billing orientation, team, and lsk_ agent APIs.

Rulebook B — refuse:
If the question is outside Loyal Spark, reply exactly: "I only help with Loyal Spark: loyalty programs, rewards, vouchers, certificates, balances, and agent APIs on Base. I can't help with that."

When an ACCOUNT DATA block is present, use it for this user's own Loyal Spark facts. Do not invent numbers that are not in that block. Keep answers short.`;

const SHOPPER_SYSTEM = `You are the Loyal Spark shopper assistant on Base (loyalspark.online).

Rulebook A — answer:
Help holders with balances, rewards, vouchers, gift certificates, and P2P escrow offers. Point to the customer portal. Do not use merchant mint or program-deploy steps.

Rulebook B — refuse:
If the question is outside Loyal Spark, reply exactly: "I only help with Loyal Spark: loyalty programs, rewards, vouchers, certificates, balances, and agent APIs on Base. I can't help with that."

When an ACCOUNT DATA block is present, use it for this user's own Loyal Spark facts. Do not invent numbers that are not in that block. Keep answers short.`;

export type ServChatResult = {
  text: string;
  model: string;
  promptVersion: string;
  usage?: { total_tokens?: number };
};

export function servConfigured(): boolean {
  return Boolean(Deno.env.get("SERV_API_KEY")?.trim());
}

export async function servConciergeReply(args: {
  role: "merchant" | "shopper";
  messages: { role: string; content: string }[];
  accountContext?: string;
}): Promise<ServChatResult> {
  const apiKey = Deno.env.get("SERV_API_KEY")?.trim();
  if (!apiKey) throw new Error("SERV_API_KEY missing");

  const model = Deno.env.get("SERV_MODEL")?.trim() || "gpt-5.4-mini";
  const base = `${args.role === "shopper" ? SHOPPER_SYSTEM : MERCHANT_SYSTEM}\n\n${PRODUCT_MAP}`;
  const system = args.accountContext
    ? `${base}\n\nACCOUNT DATA (private, this signed-in user only):\n${args.accountContext.slice(0, 6000)}`
    : base;
  const history = args.messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .slice(-6)
    .map((m) => ({ role: m.role, content: m.content }));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const res = await fetch(SERV_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        reasoning_effort: "none",
        max_tokens: 350,
        messages: [{ role: "system", content: system }, ...history],
        tools: [
          { type: "function", function: { name: "serv_prompt_guard" } },
        ],
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`SERV ${res.status}: ${detail.slice(0, 240)}`);
    }

    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content;
    const text = typeof raw === "string" ? raw.replace(/\*\*/g, "").trim() : "";
    if (!text) {
      throw new Error("Empty response from SERV Reasoning");
    }
    console.error(
      `[serv] concierge prompt=${PROMPT_VERSION} model=${data.model ?? model} tokens=${data.usage?.total_tokens ?? "?"}`,
    );
    return {
      text: text.trim(),
      model: typeof data.model === "string" ? data.model : model,
      promptVersion: PROMPT_VERSION,
      usage: data.usage,
    };
  } finally {
    clearTimeout(timer);
  }
}
