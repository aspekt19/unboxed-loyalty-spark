/**
 * Unit tests for agent-rate-limit helpers (no live DB).
 */
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  checkAgentApiRateLimits,
  resolveAgentRateLimitKind,
  type RateLimitResult,
} from "./agent-rate-limit.ts";
import { preloadAdminWallets } from "./admin-wallets.ts";

// The admin-wallet list decrypts once at module load. Await it here so the
// async crypto work never resolves in the middle of a test (op leak).
await preloadAdminWallets();

const TEST_AGENT = {
  id: "11111111-1111-1111-1111-111111111111",
  owner_address: "0x00000000000000000000000000000000000000ff",
  rate_limit_per_minute: 60,
  plan_id: null,
};

/** Minimal Supabase stub: records rpc calls, answers the agent_plans lookup. */
function stubClient(opts: { maxCalls: number | null; rpc: Record<string, unknown> }) {
  const rpcCalls: { name: string; args: Record<string, unknown> }[] = [];
  const planQuery: any = {
    select: () => planQuery,
    eq: () => planQuery,
    single: () =>
      Promise.resolve({ data: { max_api_calls_monthly: opts.maxCalls }, error: null }),
  };
  return {
    rpcCalls,
    from: () => planQuery,
    rpc: (name: string, args: Record<string, unknown>) => {
      rpcCalls.push({ name, args });
      return Promise.resolve({ data: opts.rpc[name], error: null });
    },
  };
}

Deno.test("resolveAgentRateLimitKind: default / merchant activity table → merchant", () => {
  assertEquals(resolveAgentRateLimitKind(undefined), "merchant");
  assertEquals(resolveAgentRateLimitKind({ activityTable: "agent_activity_log" }), "merchant");
});

Deno.test("resolveAgentRateLimitKind: recipient activity table → recipient", () => {
  assertEquals(
    resolveAgentRateLimitKind({ activityTable: "recipient_agent_activity_log" }),
    "recipient",
  );
});

Deno.test("RateLimitResult reasons stay within the public contract", () => {
  const ok: RateLimitResult = { ok: true };
  const perMin: RateLimitResult = { ok: false, reason: "per_minute" };
  const monthly: RateLimitResult = { ok: false, reason: "monthly_quota" };
  assertEquals(ok.ok, true);
  assertEquals(perMin.ok, false);
  assertEquals(monthly.reason, "monthly_quota");
});

Deno.test("monthly quota is consumed atomically in one RPC, not read-then-write", async () => {
  const client = stubClient({
    maxCalls: 200,
    rpc: { consume_agent_rate_limit: true, consume_agent_monthly_quota: true },
  });

  assertEquals(await checkAgentApiRateLimits(client, TEST_AGENT), { ok: true });

  const quotaCalls = client.rpcCalls.filter((c) => c.name === "consume_agent_monthly_quota");
  assertEquals(quotaCalls.length, 1);
  assertEquals(quotaCalls[0].args.p_max_calls, 200);
  assertEquals(quotaCalls[0].args.p_owner_address, TEST_AGENT.owner_address);
});

Deno.test("monthly quota rejection surfaces as monthly_quota", async () => {
  const client = stubClient({
    maxCalls: 200,
    rpc: { consume_agent_rate_limit: true, consume_agent_monthly_quota: false },
  });

  assertEquals(await checkAgentApiRateLimits(client, TEST_AGENT), {
    ok: false,
    reason: "monthly_quota",
  });
});

Deno.test("per-request paid calls skip the monthly quota entirely", async () => {
  const client = stubClient({
    maxCalls: 200,
    rpc: { consume_agent_rate_limit: true, consume_agent_monthly_quota: false },
  });

  assertEquals(
    await checkAgentApiRateLimits(client, TEST_AGENT, { skipMonthlyQuota: true }),
    { ok: true },
  );
  assertEquals(
    client.rpcCalls.some((c) => c.name === "consume_agent_monthly_quota"),
    false,
  );
});
