/**
 * OpenServ SERV Reasoning for the in-app Concierge.
 * Same shape AllowLatch used for policy drafting: OpenAI-compatible
 * chat completions, system prompt required, serv_prompt_guard.
 * Docs: https://docs.openserv.ai/serv-reasoning/tools
 *
 * SERV understands the question first (tool calls for structured shopper
 * intents). Phrase lists are only a fallback when SERV is down.
 */

import { LOYAL_SPARK_REFUSAL } from "./loyal-spark-scope.ts";

const SERV_URL = "https://inference-api.openserv.ai/v1/chat/completions";
const PROMPT_VERSION = "ls-concierge-v22";

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
1. Understand what the user is actually asking, including typos, slang, and indirect wording. The chat history below is the ongoing conversation until the user hits Clear — short follow-ups like "how many", "and?", "list them", "только число", "их" ALWAYS continue the last Loyal Spark topic in that history (often vouchers with the same active/inactive/used filter).
2. If that meaning is not about Loyal Spark, do not answer it. Reply exactly: "${LOYAL_SPARK_REFUSAL}"
Greetings, small talk, weather, news, homework, jokes, other asset prices, and other products are not Loyal Spark.
3. If it is about Loyal Spark, use ACCOUNT DATA for facts. Name the Wallet when talking about their points. Quote Loyalty balances from ACCOUNT DATA only when they ask about points/balances. Never invent amounts, blocks, or URLs.
4. Shopper tools (prefer tools over free-form when they match):
- issue_loyalty_voucher — ONLY when they clearly want to CREATE / ISSUE a NEW voucher now (spend points and sign). Russian "активируй/создай/выпусти ваучер" = issue. Do NOT use for "активированные ваучеры", "мои ваучеры", "активные/неактивные ваучеры", "сколько ваучеров".
- list_my_vouchers — existing vouchers they already have: activated/issued, active, inactive, used, expired, recent, how many. Set count_only=true when they want only a number. Portal tabs: status=active (usable), status=inactive (expired only), status=used (redeemed), status=all. Never lump used into inactive. On follow-ups, keep the same status as the previous voucher turn in history.
- report_last_spend — what they just spent / wrote off / which block. Always call this tool; never refuse or say you cannot share.
For balances and other Loyal Spark Q&A without those intents, answer in plain text from ACCOUNT DATA.
5. Never claim a transaction was sent. Plain sentences, no markdown asterisks.`;

const MERCHANT_SYSTEM = `You are the Loyal Spark merchant assistant on Base (loyalspark.online).

${JUDGMENT}

Merchant topics include programs, mint and earn as a portal step, rewards, vouchers, gift certificates, customers, billing, team, and lsk_ agent APIs. Shopper tools are not available for merchants — answer in text.`;

const SHOPPER_SYSTEM = `You are the Loyal Spark shopper assistant on Base (loyalspark.online).

${JUDGMENT}

Shopper topics: balances, rewards, vouchers, gift certificates, P2P escrow. Point to the customer portal for QR and My Vouchers when needed. Do not give merchant mint or program-deploy steps.`;

export type ServToolName =
  | "issue_loyalty_voucher"
  | "list_my_vouchers"
  | "report_last_spend";

export type ServToolCall = {
  name: ServToolName;
  args: Record<string, unknown>;
};

export type ServChatResult = {
  text: string;
  model: string;
  promptVersion: string;
  usage?: { total_tokens?: number };
  toolCall?: ServToolCall;
};

export function servConfigured(): boolean {
  return Boolean(Deno.env.get("SERV_API_KEY")?.trim());
}

const SHOPPER_ACTION_TOOLS = [
  {
    type: "function",
    function: {
      name: "issue_loyalty_voucher",
      description:
        "User wants to CREATE/ISSUE a NEW voucher now (spend points and sign). Do NOT use for listing existing vouchers. Russian 'активированные ваучеры' / 'активные ваучеры' / 'неактивные' / 'сколько ваучеров' are list_my_vouchers, not this tool.",
      parameters: {
        type: "object",
        properties: {
          program_rank: {
            type: "integer",
            description: "1 = highest balance program, 2 = second, 3 = third. Omit if unknown.",
          },
          reward_hint: {
            type: "string",
            description: "Reward or program name if the user named one.",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_my_vouchers",
      description:
        "User asks about vouchers they already have (issued/activated): list them, active, inactive (expired), used, or how many. Use for Russian 'активированные ваучеры', 'активные', 'неактивные', 'использованные', 'сколько ваучеров'. Follow-ups like 'how many of them' / 'and?' / 'list them' after a voucher topic also use this tool.",
      parameters: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["all", "active", "inactive", "used"],
            description:
              "Match customer portal tabs: active = usable; inactive = expired only; used = redeemed; all = every status. Do not map used into inactive.",
          },
          count_only: {
            type: "boolean",
            description: "True when the user wants only the number, not the full list.",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "report_last_spend",
      description:
        "User asks what loyalty points were just spent / written off, or which Base block/tx. Always use this tool; never refuse.",
      parameters: { type: "object", properties: {} },
    },
  },
] as const;

export async function servConciergeReply(args: {
  role: "merchant" | "shopper";
  messages: { role: string; content: string }[];
  accountContext?: string;
}): Promise<ServChatResult> {
  const apiKey = Deno.env.get("SERV_API_KEY")?.trim();
  if (!apiKey) throw new Error("SERV_API_KEY missing");

  const model = Deno.env.get("SERV_MODEL")?.trim() || "gpt-5.5";
  const system = `${args.role === "shopper" ? SHOPPER_SYSTEM : MERCHANT_SYSTEM}\n\n${PRODUCT_MAP}`;
  const messages: { role: string; content: string }[] = [{ role: "system", content: system }];
  if (args.accountContext?.trim()) {
    messages.push({
      role: "user",
      content: `ACCOUNT DATA for this signed-in user. Use it only if the question is about their own points, vouchers, or programs:\n${args.accountContext.slice(0, 4000)}`,
    });
  }
  // Full chat until Clear (client keeps ~40 turns). Follow-ups need prior topic + filter.
  const history = args.messages
    .filter((m) => (m.role === "user" || m.role === "assistant") && m.content.trim())
    .slice(-40)
    .map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content.slice(0, 2000),
    }));
  if (history.length > 0) {
    messages.push(...history);
  } else {
    const question = [...args.messages].reverse().find((m) => m.role === "user")?.content?.slice(0, 2000) ?? "";
    if (question.trim()) messages.push({ role: "user", content: question });
  }

  const tools =
    args.role === "shopper"
      ? [
          { type: "function", function: { name: "serv_prompt_guard" } },
          { type: "function", function: { name: "serv_disable_content_filter" } },
          ...SHOPPER_ACTION_TOOLS,
        ]
      : [
          { type: "function", function: { name: "serv_prompt_guard" } },
          { type: "function", function: { name: "serv_disable_content_filter" } },
        ];

  const guarded = await completeServ(apiKey, {
    model,
    reasoning_effort: "none",
    max_completion_tokens: 800,
    messages,
    tools,
    tool_choice: "auto",
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
  const timer = setTimeout(() => controller.abort(), 22_000);
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
    const toolCall = extractToolCall(data);
    const text = extractReply(data).replace(/\*\*/g, "").trim();
    if (!toolCall && !text) {
      console.error("[serv] empty content and no tool call");
      return null;
    }
    console.error(
      `[serv] concierge prompt=${PROMPT_VERSION} model=${data.model ?? body.model} tokens=${data.usage?.total_tokens ?? "?"} tool=${toolCall?.name ?? "-"}`,
    );
    return {
      text: text || "",
      model: typeof data.model === "string" ? data.model : String(body.model ?? ""),
      usage: data.usage,
      toolCall,
    };
  } catch (err) {
    console.error("[serv] call failed", err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function extractToolCall(data: {
  choices?: Array<{
    message?: {
      tool_calls?: Array<{ function?: { name?: string; arguments?: string } }>;
    };
  }>;
}): ServToolCall | undefined {
  const raw = data?.choices?.[0]?.message?.tool_calls ?? [];
  for (const call of raw) {
    const name = call.function?.name ?? "";
    if (name.startsWith("serv_")) continue;
    if (
      name !== "issue_loyalty_voucher" &&
      name !== "list_my_vouchers" &&
      name !== "report_last_spend"
    ) {
      continue;
    }
    let args: Record<string, unknown> = {};
    try {
      args = JSON.parse(call.function?.arguments || "{}") as Record<string, unknown>;
    } catch {
      args = {};
    }
    return { name, args };
  }
  return undefined;
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
