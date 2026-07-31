/**
 * Unit tests for agent-rate-limit helpers (no live DB).
 */
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  resolveAgentRateLimitKind,
  type RateLimitResult,
} from "./agent-rate-limit.ts";

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
