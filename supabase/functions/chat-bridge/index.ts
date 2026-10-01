import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { loadAccountContext } from "../_shared/concierge-account.ts";
import { isLoyalSparkScoped, LOYAL_SPARK_REFUSAL } from "../_shared/loyal-spark-scope.ts";
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
    const wallet = await portalWallet(userClient, profile?.wallet_address ?? null);
    const actor = wallet ?? `user:${user.id}`;

    const body = await req.json().catch(() => ({}));
    const role: ChatRole = body.role === "shopper" ? "shopper" : "merchant";
    const messages = normalizeMessages(body.messages);
    const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";

    if (!lastUser.trim()) {
      return json({ error: "Empty message" }, 400);
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
      // Roles are server-owned: caller text is always treated as user input.
      const role = "user";
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

async function portalWallet(
  // deno-lint-ignore no-explicit-any
  userClient: any,
  profileWallet: string | null,
): Promise<string | null> {
  try {
    const { data } = await userClient.rpc("get_my_identity_summary");
    const primary = data && typeof data === "object" ? (data as { primary_wallet?: string | null }).primary_wallet : null;
    const chosen = (primary || profileWallet || "").trim().toLowerCase();
    return chosen || null;
  } catch (err) {
    console.error("[chat-bridge] identity", err);
    return profileWallet?.toLowerCase() ?? null;
  }
}

function sectionLines(accountContext: string, title: string): string[] {
  const block = accountContext.split("\n");
  const start = block.findIndex((line) => line.startsWith(title));
  if (start < 0) return [];
  const rows: string[] = [];
  for (let i = start + 1; i < block.length; i++) {
    if (!block[i].startsWith("- ")) break;
    rows.push(block[i].replace(/^- /, ""));
  }
  return rows;
}

function modelFallback(lastUser: string, accountContext: string): string {
  if (!isLoyalSparkScoped(lastUser)) return LOYAL_SPARK_REFUSAL;
  const ru = /[а-яё]/i.test(lastUser);
  const guide = "https://loyalspark.online/guide";
  const balances = sectionLines(accountContext, "Loyalty balances").slice(0, 8);
  const vouchers = sectionLines(accountContext, "Vouchers");
  const programs = sectionLines(accountContext, "Programs");
  const parts: string[] = [];
  if (balances.length > 0) {
    parts.push(ru
      ? `Ваши баллы, от большего к меньшему:\n${balances.map((row) => `• ${row}`).join("\n")}\nБольше всего баллов в ${balances[0]}.`
      : `Your points, highest first:\n${balances.map((row) => `• ${row}`).join("\n")}\nYou have the most points in ${balances[0]}.`);
  } else if (programs.length > 0) {
    parts.push(ru
      ? `Ваши программы:\n${programs.map((row) => `• ${row}`).join("\n")}`
      : `Your programs:\n${programs.map((row) => `• ${row}`).join("\n")}`);
  }
  if (vouchers.length > 0) {
    parts.push(ru
      ? `Ваучеры:\n${vouchers.map((row) => `• ${row}`).join("\n")}`
      : `Vouchers:\n${vouchers.map((row) => `• ${row}`).join("\n")}`);
  }
  parts.push(ru ? `Гайд: ${guide}` : `Guide: ${guide}`);
  return parts.join("\n");
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
