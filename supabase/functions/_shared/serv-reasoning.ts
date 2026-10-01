/**
 * OpenServ SERV Reasoning for the in-app Concierge.
 * Same shape AllowLatch used for policy drafting: OpenAI-compatible
 * chat completions, system prompt required, serv_prompt_guard.
 * Docs: https://docs.openserv.ai/serv-reasoning/tools
 *
 * SERV reads the question first. If the meaning is outside Loyal Spark, it
 * refuses. Phrase lists do not decide the concierge reply.
 */

import { LOYAL_SPARK_REFUSAL } from "./loyal-spark-scope.ts";

const SERV_URL = "https://inference-api.openserv.ai/v1/chat/completions";
const PROMPT_VERSION = "ls-concierge-v14";

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

const JUDGMENT = `How to answer:
1. Understand what the user is actually asking, including typos, slang, and indirect wording.
2. If that meaning is not about Loyal Spark, do not answer it. Reply exactly: "${LOYAL_SPARK_REFUSAL}"
Greetings, small talk, weather, news, homework, jokes, other asset prices, and other products are not Loyal Spark.
3. If it is about Loyal Spark, answer that question in the user's language. A later user message labeled ACCOUNT DATA holds this user's own numbers. The first sentence of any answer about their points must name the Wallet address and the Loyalty balances (program and amount). That list is the customer portal. Do not add programs that are not in it, and do not replace them with older mint amounts. If they ask which points were just spent, or which block a transfer was written in, then add what Chain transfers shows: quote the block number and tx hash. If that section says none, say no outgoing loyalty transfer was found in the last 10000 Base blocks for that named wallet. If that section says the lookup failed, say the chain read failed. Do not claim there was no transfer when the lookup failed. Do not ask them to resend the wallet. Do not invent a block. A voucher row is not chain proof. The product map is how the portal works. Do not invent numbers or URLs. Do not reply with a generic menu. Never claim a transaction was sent. Plain sentences, no markdown asterisks.`;

const MERCHANT_SYSTEM = `You are the Loyal Spark merchant assistant on Base (loyalspark.online).

${JUDGMENT}

Merchant topics include programs, mint and earn as a portal step, rewards, vouchers, gift certificates, customers, billing, team, and lsk_ agent APIs.`;

const SHOPPER_SYSTEM = `You are the Loyal Spark shopper assistant on Base (loyalspark.online).

${JUDGMENT}

Shopper topics include their balances, rewards, vouchers, gift certificates, and P2P escrow. Point to the customer portal. Do not give merchant mint or program-deploy steps.`;

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
  const system = `${args.role === "shopper" ? SHOPPER_SYSTEM : MERCHANT_SYSTEM}\n\n${PRODUCT_MAP}`;
  const question = [...args.messages].reverse().find((m) => m.role === "user")?.content?.slice(0, 2000) ?? "";
  const messages: { role: string; content: string }[] = [{ role: "system", content: system }];
  if (args.accountContext?.trim()) {
    messages.push({
      role: "user",
      content: `ACCOUNT DATA for this signed-in user. Use it only if the question is about their own points, vouchers, or programs:\n${args.accountContext.slice(0, 4000)}`,
    });
  }
  if (question.trim()) messages.push({ role: "user", content: question });

  const guarded = await completeServ(apiKey, {
    model,
    reasoning_effort: "none",
    max_completion_tokens: 800,
    messages,
    tools: [
      { type: "function", function: { name: "serv_prompt_guard" } },
      { type: "function", function: { name: "serv_disable_content_filter" } },
    ],
  });
  if (guarded) return { ...guarded, promptVersion: PROMPT_VERSION };

  const plain = await completeServ(apiKey, {
    model,
    max_completion_tokens: 800,
    messages,
  });
  if (plain) return { ...plain, promptVersion: PROMPT_VERSION };
  throw new Error("Empty response from SERV Reasoning");
}

async function completeServ(
  apiKey: string,
  body: Record<string, unknown>,
): Promise<Omit<ServChatResult, "promptVersion"> | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch(SERV_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const detail = await res.text();
      console.error(`[serv] ${res.status}: ${detail.slice(0, 240)}`);
      return null;
    }
    const data = await res.json();
    const text = extractReply(data).replace(/\*\*/g, "").trim();
    if (!text) {
      console.error("[serv] empty content");
      return null;
    }
    console.error(
      `[serv] concierge prompt=${PROMPT_VERSION} model=${data.model ?? body.model} tokens=${data.usage?.total_tokens ?? "?"}`,
    );
    return {
      text,
      model: typeof data.model === "string" ? data.model : String(body.model ?? ""),
      usage: data.usage,
    };
  } catch (err) {
    console.error("[serv] call failed", err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function extractReply(data: {
  choices?: Array<{ message?: { content?: unknown } }>;
  output_text?: unknown;
}): string {
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part && typeof part.text === "string") return part.text;
        return "";
      })
      .join("");
  }
  return typeof data?.output_text === "string" ? data.output_text : "";
}
