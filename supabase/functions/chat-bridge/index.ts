import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { asksForOwnLoyaltyList, isLoyalSparkScoped, LOYAL_SPARK_REFUSAL } from "../_shared/loyal-spark-scope.ts";
import { loadAccountContext, shopperHoldingLines } from "../_shared/concierge-account.ts";
import { servConciergeReply, servConfigured } from "../_shared/serv-reasoning.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform",
};

type ChatRole = "merchant" | "shopper";
type ChatMessage = { role: "user" | "assistant" | "system"; content: string };

const DAILY_LIMIT = Number(Deno.env.get("CHAT_MESSAGES_PER_DAY") || "40");

/** In-isolate health gate for OpenServ (plan kill-switch). */
let openservFailStreak = 0;
let openservDisabledUntil = 0;

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

    const howTo = /гайд|guide|how to|faq|инструкц|как созда|как польз|как найти|как работает/i.test(lastUser);
    let accountContext = "";
    if (wallet && !howTo) {
      try {
        accountContext = await loadAccountContext(service, role, wallet);
      } catch (err) {
        console.error("[chat-bridge] account", err);
      }
    }

    if (asksForOwnLoyaltyList(lastUser)) {
      const reply = await answerOwnLoyaltyList(service, role, wallet, lastUser);
      return json({ reply, role, wallet, source: "account" });
    }

    if (Date.now() < openservDisabledUntil) {
      return json({
        disabled: true,
        reply: "Assistant temporarily unavailable. Please try again in a few minutes.",
      }, 503);
    }

    if (servConfigured()) {
      try {
        const serv = await servConciergeReply({ role, messages, accountContext });
        openservFailStreak = 0;
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
        openservFailStreak += 1;
        if (openservFailStreak >= 3) {
          openservDisabledUntil = Date.now() + 5 * 60_000;
          openservFailStreak = 0;
        }
        return json({
          disabled: true,
          reply: "Assistant temporarily unavailable. Please try again shortly.",
        }, 503);
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

        if (!upstream.ok) {
          openservFailStreak += 1;
          if (openservFailStreak >= 3) {
            openservDisabledUntil = Date.now() + 5 * 60_000;
            openservFailStreak = 0;
          }
          return json({
            disabled: true,
            reply: "Assistant temporarily unavailable. Please try again shortly.",
          }, 503);
        }

        openservFailStreak = 0;
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
      } catch {
        clearTimeout(timer);
        openservFailStreak += 1;
        if (openservFailStreak >= 3) {
          openservDisabledUntil = Date.now() + 5 * 60_000;
          openservFailStreak = 0;
        }
        return json({
          disabled: true,
          reply: "Assistant temporarily unavailable. Please try again shortly.",
        }, 503);
      }
    }

    // Local scoped stub until OpenServ Concierge URL is configured (still HARD SCOPE).
    return json({
      reply: localScopedReply(role, lastUser),
      role,
      wallet,
      source: "local_stub",
      hint: "Set SERV_API_KEY (OpenServ Reasoning) to answer via SERV. Hosted Concierge URL is the fallback.",
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

function localScopedReply(role: ChatRole, lastUser: string): string {
  const q = lastUser.toLowerCase();
  if (/гайд|guide|how to|faq|инструкц|как созда|как польз|как найти/.test(q)) {
    return "Start at https://loyalspark.online/guide (Getting Started, For Merchants, For Customers, For AI Agents, FAQ). Merchants: https://loyalspark.online/merchant — programs, rewards, certificates, customers, billing, AI agents. Shoppers: https://loyalspark.online/customer. Agents: https://loyalspark.online/for-agents.";
  }
  if (role === "merchant") {
    if (/mint|начисл|earn|cashback/.test(q)) {
      return "To mint or earn points: open **Programs**, select a program, then Mint / Earn. Agent path: MCP `mint_loyalty_tokens` / `earn_points` (then confirm fee). I stay on Loyal Spark only — say what program or customer you mean.";
    }
    if (/reward|ваучер|voucher|сертификат|certificate/.test(q)) {
      return "Rewards & vouchers live under **Rewards**; gift certificates under **Certificates**. Agents: `create_reward`, `create_gift_certificate`, `use_voucher`. Ask a Loyal Spark–specific next step.";
    }
    if (/analy|stat|customer|клиент|report/.test(q)) {
      return "Use **Dashboard** / **Customers** for live numbers, or the Stage A Analyst OpenServ workflow (`send_report`). I can guide Loyal Spark metrics only — which program should we inspect?";
    }
    return "I'm the Loyal Spark merchant assistant. I only help with programs, minting, rewards, vouchers, certificates, team, billing, and agent APIs on Base. What do you want to do in the portal?";
  }
  if (/balance|баланс|reward|redeem|обмен|voucher|ваучер/.test(q)) {
    return "Check balances and redeem under your loyalty wallet / rewards. Recipient agents use `rwk_` MCP (`list_my_loyalty_balances`, `redeem_my_reward`). I only help with Loyal Spark — which merchant program?";
  }
  return "I'm the Loyal Spark shopper assistant. I only help with balances, rewards, vouchers, certificates, and P2P escrow on Base — not general chat. What do you need?";
}

async function answerOwnLoyaltyList(
  // deno-lint-ignore no-explicit-any
  service: any,
  role: ChatRole,
  wallet: string | null,
  question: string,
): Promise<string> {
  const ru = /[а-яё]/i.test(question);
  if (!wallet) {
    return ru
      ? "Подключите кошелёк к профилю — тогда я покажу магазины, от которых у вас есть баллы."
      : "Connect a wallet to your profile and I can list the stores you have loyalty with.";
  }

  try {
    if (role === "merchant") {
      const { data, error } = await service
        .from("loyalty_programs")
        .select("name, symbol, status")
        .eq("merchant_address", wallet)
        .in("status", ["active", "expiring_soon", "paused"]);
      if (error) throw error;
      const rows = (data ?? []) as { name: string; symbol: string; status: string }[];
      if (rows.length === 0) {
        return ru
          ? "У этого кошелька нет своих программ лояльности."
          : "This wallet has no loyalty programs of its own.";
      }
      const lines = rows.map((p) => `• ${p.name} (${p.symbol}) — ${p.status}`);
      return (ru ? "Ваши программы:\n" : "Your programs:\n") + lines.join("\n");
    }

    const held = await shopperHoldingLines(service, wallet);
    if (held.length === 0) {
      return ru
        ? "На этом кошельке нет баллов ни в одной программе."
        : "This wallet has no loyalty balances yet.";
    }
    const lines = held.map((line) => line.replace(/^- /, "• "));
    return (ru
      ? "Магазины, от которых у вас есть программа лояльности:\n"
      : "Stores you have loyalty with:\n") + lines.join("\n");
  } catch (err) {
    console.error("[chat-bridge] holdings", err);
    return ru
      ? "Не смог прочитать балансы. Обновите страницу и спросите ещё раз."
      : "I couldn't read your balances. Refresh the page and ask again.";
  }
}

function formatAmount(n: number): string {
  if (!Number.isFinite(n)) return "0";
  const rounded = Math.round(n * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
