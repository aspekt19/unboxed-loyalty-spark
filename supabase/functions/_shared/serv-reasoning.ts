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
const PROMPT_VERSION = "ls-concierge-v25";

const PRODUCT_MAP = `How Loyal Spark works (use this for how-to; never invent pages or on-chain facts):
Loyal Spark is an onchain loyalty protocol on Base (chain id 8453). Merchants deploy a loyalty token (default B20 factory; legacy ERC-20 factory still exists for older programs). Customers hold points on their wallet, redeem rewards into vouchers (QR in My Vouchers), gift certificates are a separate catalog, P2P escrow offers exist. Loyal Spark does not offer DEX trading or DeFi yield products — never recommend them.

Core loops:
- Merchant: create program → activate → create rewards → mint or earn points to customer wallets → customer redeems → merchant marks voucher used in store / API.
- Shopper: connect wallet → receive points → redeem reward → show voucher QR → spend.
- Agents: merchant lsk_ keys on REST/MCP; holder rwk_ keys; pay-per-call via x402 (USDC on Base) or MPP. Mint fee % is paid in the merchant's loyalty tokens to the platform fee wallet — not USDC. Cash revenue = SaaS subscriptions + x402/MPP.

Portal click paths (name these when teaching):
- Guide: https://loyalspark.online/guide (Getting Started, Merchants, Customers, AI Agents, FAQ)
- Agents: https://loyalspark.online/for-agents · skills https://loyalspark.online/.well-known/skills/index.md · API https://loyalspark.online/api-docs · pricing https://loyalspark.online/pricing · examples https://loyalspark.online/examples
- Merchant https://loyalspark.online/merchant — ?tab=dashboard | programs | rewards | certificates | customers | marketing | billing | agents | assistant | team. Create program under Programs; mint/earn inside the selected program; USDC billing on Billing; lsk_ keys under Agents; invites under Team.
- Customer https://loyalspark.online/customer — Loyalty (balances, rewards, vouchers, certificates), Discover, Exchange (P2P). Sign-in: email/SMS/Google/wallet. Balances belong to the connected wallet.
- Voucher tabs (both portals): Active = status active; Inactive = expired only; Used = used. Do not merge used into inactive.
- Runtime API host: https://api.loyalspark.online (agent-api, loyalty-mcp, x402-gateway, mpp-gateway). Marketing site is loyalspark.online.

When explaining "how", give the shortest portal path + guide link. Reply in the user's language. Plain sentences; no markdown asterisks; only URLs listed above or basescan.org tx/block links from ACCOUNT DATA.`;

const SCOPE_RULES = `Scope and style:
1. Chat history is live until Clear — short follow-ups ("how many", "только число", "их", "and?") continue the last Loyal Spark topic and filter.
2. If the question is not about Loyal Spark, reply exactly: "${LOYAL_SPARK_REFUSAL}"
   Off-topic: weather, news, homework, jokes, other products, BTC/ETH speculation, general coding, roleplay.
3. Prefer tools / ACCOUNT DATA for facts. Never invent amounts, statuses, blocks, or URLs.
4. Never claim a transaction was broadcast. For mint/create/deploy: describe the portal step and ask for confirmation in the UI — do not pretend it is done.
5. Plain sentences, no markdown asterisks.`;

const SHOPPER_JUDGMENT = `${SCOPE_RULES}

Shopper tools (prefer over free-form):
- issue_loyalty_voucher — CREATE a NEW voucher now (spend + sign). Not for listing existing vouchers.
- list_my_vouchers — existing vouchers; status=active|inactive(expired)|used|all; count_only for a number.
- list_my_balances — full loyalty balances / program count. Do NOT use for “where do points come from / как получить баллы / откуда берутся баллы” — answer that from PRODUCT_MAP (merchant mints/earns at checkout when they show QR).
- list_affordable_rewards — full affordable rewards / count.
- report_last_spend — last loyalty spend + block/tx; never refuse. Prefer this after a redeem.
Otherwise answer from ACCOUNT DATA. Point to customer portal Loyalty / My Vouchers for QR.`;

const MERCHANT_JUDGMENT = `${SCOPE_RULES}

Merchant tools (prefer over free-form):
- list_merchant_programs — this merchant's loyalty programs (or count).
- list_merchant_rewards — this merchant's rewards catalog (or count).
- list_merchant_vouchers — vouchers for this merchant; status=active|inactive(expired)|used|all; count_only supported.
- list_merchant_certificates — gift certificates (or count).
- list_merchant_mints — recent mint history.
For mint, earn, create reward, create program, team invite, billing, or lsk_ keys: explain the merchant portal tab path from PRODUCT_MAP; do not invent tx hashes. Shopper-only tools are unavailable.`;

const MERCHANT_SYSTEM = `You are the Loyal Spark merchant assistant on Base (loyalspark.online). You know the product like an in-house operator: portals, programs, rewards, vouchers, certificates, mint/earn, billing, team, and agent APIs — Loyal Spark only.

${MERCHANT_JUDGMENT}`;

const SHOPPER_SYSTEM = `You are the Loyal Spark shopper assistant on Base (loyalspark.online). You know the product like an in-house operator for holders: balances, rewards, vouchers, certificates, P2P — Loyal Spark only. Do not give merchant mint or program-deploy steps.

${SHOPPER_JUDGMENT}`;

export type ServToolName =
  | "issue_loyalty_voucher"
  | "list_my_vouchers"
  | "list_my_balances"
  | "list_affordable_rewards"
  | "report_last_spend"
  | "list_merchant_programs"
  | "list_merchant_rewards"
  | "list_merchant_vouchers"
  | "list_merchant_certificates"
  | "list_merchant_mints";

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
  {
    type: "function",
    function: {
      name: "list_my_balances",
      description:
        "User asks about their loyalty points / balances / how many programs they hold. Returns the full portal-style list (not a truncated preview).",
      parameters: {
        type: "object",
        properties: {
          count_only: {
            type: "boolean",
            description: "True when they want only how many programs have a balance.",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_affordable_rewards",
      description:
        "User asks which rewards they can afford / list of rewards (not create a voucher). Full affordable list or count.",
      parameters: {
        type: "object",
        properties: {
          count_only: {
            type: "boolean",
            description: "True when they want only the number of affordable rewards.",
          },
        },
      },
    },
  },
] as const;

const MERCHANT_ACTION_TOOLS = [
  {
    type: "function",
    function: {
      name: "list_merchant_programs",
      description: "List or count this merchant's loyalty programs.",
      parameters: {
        type: "object",
        properties: {
          count_only: { type: "boolean", description: "True for program count only." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_merchant_rewards",
      description: "List or count this merchant's rewards catalog.",
      parameters: {
        type: "object",
        properties: {
          count_only: { type: "boolean", description: "True for reward count only." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_merchant_vouchers",
      description:
        "List or count vouchers issued under this merchant. status: active | inactive (expired only) | used | all.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["all", "active", "inactive", "used"] },
          count_only: { type: "boolean" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_merchant_certificates",
      description: "List or count this merchant's gift certificates.",
      parameters: {
        type: "object",
        properties: { count_only: { type: "boolean" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_merchant_mints",
      description: "Recent mint history for this merchant.",
      parameters: {
        type: "object",
        properties: { count_only: { type: "boolean" } },
      },
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
      content: `ACCOUNT DATA for this signed-in ${args.role}. Use only for their own Loyal Spark account facts:\n${args.accountContext.slice(0, 16000)}`,
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
          ...MERCHANT_ACTION_TOOLS,
        ];

  const guarded = await completeServ(apiKey, {
    model,
    reasoning_effort: "low",
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
      name !== "list_my_balances" &&
      name !== "list_affordable_rewards" &&
      name !== "report_last_spend" &&
      name !== "list_merchant_programs" &&
      name !== "list_merchant_rewards" &&
      name !== "list_merchant_vouchers" &&
      name !== "list_merchant_certificates" &&
      name !== "list_merchant_mints"
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
