/**
 * Concierge regression eval: runs EVAL_CASES through the real agent loop (SERV)
 * with mock account data. Returns pass/fail per case. No user data is touched.
 * Rate limited (global, 6 runs/hour) because each run spends SERV credits.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { runConciergeAgent } from "../_shared/concierge-agent.ts";
import { checkCase, EVAL_CASES, MOCK_WALLET, mockExecute } from "../_shared/concierge-eval-cases.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const out = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b, null, 1), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

  const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: allowed } = await service.rpc("consume_wallet_rate_limit", {
    p_scope: "concierge-eval",
    p_subject: "global",
    p_limit: 40,
    p_window_seconds: 3600,
  });
  if (allowed === false) return out({ error: "rate_limited" }, 429);

  const url = new URL(req.url);
  const only = url.searchParams.get("only");
  const offset = Number(url.searchParams.get("offset") ?? 0);
  const limit = Number(url.searchParams.get("limit") ?? 8);
  const cases = only
    ? EVAL_CASES.filter((c) => only.split(",").includes(c.id))
    : EVAL_CASES.slice(offset, offset + limit);

  const results: Array<{ id: string; pass: boolean; fails: string[]; tools: string[]; ms: number; reply: string }> = [];
  for (let i = 0; i < cases.length; i += 3) {
    const batch = await Promise.all(cases.slice(i, i + 3).map(async (c) => {
      const t0 = Date.now();
      const r = await runConciergeAgent({
        role: c.role,
        wallet: MOCK_WALLET,
        messages: c.messages,
        execute: mockExecute(c.role),
      }).catch(() => null);
      const ms = Date.now() - t0;
      if (!r) return { id: c.id, pass: false, fails: ["agent returned null"], tools: [], ms, reply: "" };
      const fails = checkCase(c, r.reply, r.toolsUsed);
      return { id: c.id, pass: fails.length === 0, fails, tools: r.toolsUsed, ms, reply: r.reply.slice(0, 400) };
    }));
    results.push(...batch);
  }
  const passed = results.filter((r) => r.pass).length;
  return out({ passed, total: results.length, all: EVAL_CASES.length, ok: passed === results.length, results });
});
