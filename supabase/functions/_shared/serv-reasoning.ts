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
const PROMPT_VERSION = "ls-concierge-v2";

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
  const base = args.role === "shopper" ? SHOPPER_SYSTEM : MERCHANT_SYSTEM;
  const system = args.accountContext
    ? `${base}\n\nACCOUNT DATA (private, this signed-in user only):\n${args.accountContext.slice(0, 6000)}`
    : base;
  const history = args.messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .slice(-12)
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
        reasoning_effort: "low",
        messages: [{ role: "system", content: system }, ...history],
        tools: [
          { type: "function", function: { name: "serv_prompt_guard" } },
          {
            type: "function",
            function: {
              name: "serv_shadow_agent",
              description: "Enable SERV shadow-agent validation.",
              parameters: {
                type: "object",
                properties: {
                  hint: {
                    type: "string",
                    default:
                      "Stay on Loyal Spark. Use ACCOUNT DATA for this user's numbers. Off-topic must use the exact refusal sentence. Do not invent balances.",
                  },
                  max_iterations: { type: "integer", default: 2 },
                },
              },
            },
          },
        ],
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`SERV ${res.status}: ${detail.slice(0, 240)}`);
    }

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    if (typeof text !== "string" || !text.trim()) {
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
