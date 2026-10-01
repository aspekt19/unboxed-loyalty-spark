import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isLoyalSparkScoped, LOYAL_SPARK_REFUSAL } from "../_shared/loyal-spark-scope.ts";
import { loadAccountContext } from "../_shared/concierge-account.ts";
import { servConciergeReply, servConfigured } from "../_shared/serv-reasoning.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform",
};

type ChatRole = "merchant" | "shopper";
type ChatMessage = { role: "user" | "assistant" | "system"; content: string };

const DAILY_LIMIT = Number(Deno.env.get("CHAT_MESSAGES_PER_DAY") || "40");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "POST only" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { data: profile } = await service
      .from("profiles")
      .select("wallet_address")
      .eq("user_id", user.id)
      .maybeSingle();
    const wallet = profile?.wallet_address?.toLowerCase() ?? null;
    const actor = wallet ?? `user:${user.id}`;

    const body = await req.json().catch(() => ({}));
    const role: ChatRole = body.role === "shopper" ? "shopper" : "merchant";
    const messages = normalizeMessages(body.messages);
    const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";

    if (!lastUser.trim()) {
      return json({ error: "Empty message" }, 400);
    }

    // HARD SCOPE — refuse before OpenServ / quota
    if (!isLoyalSparkScoped(lastUser)) {
      return json({
        reply: LOYAL_SPARK_REFUSAL,
        refused: true,
        role,
        wallet,
        source: "scope",
      });
    }

    let usage = 0;
    try {
      usage = await bumpDailyUsage(service, actor);
    } catch (err) {
      // Quota tracking must never break the assistant — log and continue.
      console.error("[chat-bridge] usage tracking failed", err);
    }
    if (usage > DAILY_LIMIT) {
      return json({
        error: "daily_limit",
        message: `Daily assistant limit (${DAILY_LIMIT}) reached. Try again tomorrow.`,
        disabled: false,
      }, 429);
    }

    let accountContext = "";
    if (wallet) {
      try {
        accountContext = await loadAccountContext(service, role, wallet);
      } catch (err) {
        console.error("[chat-bridge] account", err);
      }
    }

    if (servConfigured()) {
      try {
        const serv = await servConciergeReply({ role, messages, accountContext });
        return json({
          reply: serv.text,
          role,
          wallet,
          source: "serv",
          model: serv.model,
          prompt_version: serv.promptVersion,
        });
      } catch (err) {
        console.error("[chat-bridge] serv", err);
      }
    }

    const openservUrl = Deno.env.get("OPENSERV_CONCIERGE_URL")?.replace(/\/$/, "");
    const openservKey = Deno.env.get("OPENSERV_CONCIERGE_API_KEY");

    if (openservUrl && openservKey) {
      const path = role === "shopper" ? "/shopper-concierge/chat" : "/merchant-concierge/chat";
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12_000);
      try {
        const upstream = await fetch(`${openservUrl}${path}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${openservKey}`,
          },
          body: JSON.stringify({
            session_id: `${role}:${wallet}`,
            messages,
            context: { wallet, role, user_id: user.id, account: accountContext },
          }),
          signal: controller.signal,
        });
        clearTimeout(timer);

        if (upstream.ok) {
          const data = await upstream.json().catch(() => ({}));
          const reply =
            typeof data.reply === "string"
              ? data.reply
              : typeof data.message === "string"
              ? data.message
              : typeof data.content === "string"
              ? data.content
              : JSON.stringify(data);
          return json({ reply, role, wallet, source: "openserv" });
        }
      } catch {
        clearTimeout(timer);
      }
    }

    return json({
      reply: modelFallback(lastUser, accountContext),
      role,
      wallet,
      source: "account",
    });
  } catch (err) {
    console.error("[chat-bridge]", err);
    return json({
      error: "assistant_unavailable",
      message: "Assistant temporarily unavailable. Please try again in a few minutes.",
    }, 503);
  }
});

function normalizeMessages(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((m) => m && typeof m === "object")
    .map((m) => {
      const o = m as Record<string, unknown>;
      const role = o.role === "assistant" || o.role === "system" ? o.role : "user";
      const content = typeof o.content === "string" ? o.content.slice(0, 4000) : "";
      return { role, content } as ChatMessage;
    })
    .filter((m) => m.content.trim().length > 0)
    .slice(-20);
}

async function bumpDailyUsage(
  // deno-lint-ignore no-explicit-any
  service: any,
  wallet: string,
): Promise<number> {
  const day = new Date().toISOString().slice(0, 10);
  const { data: row } = await service
    .from("chat_bridge_usage")
    .select("message_count")
    .eq("wallet_address", wallet)
    .eq("day", day)
    .maybeSingle();

  const next = (row?.message_count ?? 0) + 1;
  await service.from("chat_bridge_usage").upsert(
    { wallet_address: wallet, day, message_count: next },
    { onConflict: "wallet_address,day" },
  );
  return next;
}

function modelFallback(lastUser: string, accountContext: string): string {
  const ru = /[а-яё]/i.test(lastUser);
  const guide = "https://loyalspark.online/guide";
  if (accountContext.trim()) {
    return ru
      ? `Модель сейчас не ответила. Данные вашего аккаунта:\n${accountContext}\nГайд: ${guide}`
      : `The model did not answer. Your account data:\n${accountContext}\nGuide: ${guide}`;
  }
  return ru
    ? `Модель сейчас не ответила. Как устроен Loyal Spark: ${guide}`
    : `The model did not answer. How Loyal Spark works: ${guide}`;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
