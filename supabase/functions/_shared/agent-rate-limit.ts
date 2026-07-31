/**
 * Per-agent atomic per-minute limits and per-owner monthly API caps.
 */

import { isAdminWallet } from "./admin-wallets.ts";

export type AgentRateLimitRow = {
  id: string;
  owner_address: string;
  rate_limit_per_minute: number | null;
  plan_id: string | null;
};

export type RateLimitResult =
  | { ok: true }
  | { ok: false; reason: "per_minute" | "monthly_quota" };

export type AgentRateLimitOptions = {
  /** Per-request x402/MPP payment — do not consume subscription monthly quota. */
  skipMonthlyQuota?: boolean;
  /**
   * Activity table used to identify the agent type for the per-minute window.
   * Merchant (`lsk_`) agents use `agent_activity_log`; recipient (`rwk_`) agents
   * use `recipient_agent_activity_log`.
   */
  activityTable?: "agent_activity_log" | "recipient_agent_activity_log";
};

export function resolveAgentRateLimitKind(
  options?: AgentRateLimitOptions,
): "merchant" | "recipient" {
  return options?.activityTable === "recipient_agent_activity_log" ? "recipient" : "merchant";
}

async function resolveMonthlyMaxApiCalls(serviceClient: any, planId: string | null): Promise<number | null> {
  if (planId) {
    const { data: plan, error } = await serviceClient
      .from("agent_plans")
      .select("max_api_calls_monthly")
      .eq("id", planId)
      .single();
    if (error) throw error;
    return (plan as { max_api_calls_monthly?: number | null } | null)?.max_api_calls_monthly ?? null;
  }

  const { data: free, error } = await serviceClient
    .from("agent_plans")
    .select("max_api_calls_monthly")
    .eq("slug", "free")
    .single();
  if (error) throw error;
  return (free as { max_api_calls_monthly?: number | null } | null)?.max_api_calls_monthly ?? 200;
}

/** Atomically consumes a per-minute slot and verifies the monthly quota. */
export async function checkAgentApiRateLimits(
  serviceClient: any,
  agent: AgentRateLimitRow,
  options?: AgentRateLimitOptions,
): Promise<RateLimitResult> {
  if (await isAdminWallet(agent.owner_address)) return { ok: true };

  const perMinuteLimit = agent.rate_limit_per_minute ?? 60;
  const { data: withinPerMinuteLimit, error: rateLimitError } = await serviceClient.rpc(
    "consume_agent_rate_limit",
    {
      p_agent_id: agent.id,
      p_agent_kind: resolveAgentRateLimitKind(options),
      p_limit: perMinuteLimit,
      p_window_seconds: 60,
    },
  );
  if (rateLimitError || withinPerMinuteLimit !== true) {
    console.error("[rate-limit] atomic rate-limit RPC failed or rejected:", rateLimitError);
    return { ok: false, reason: "per_minute" };
  }

  if (options?.skipMonthlyQuota) return { ok: true };

  try {
    const maxCalls = await resolveMonthlyMaxApiCalls(serviceClient, agent.plan_id);
    if (maxCalls === null) return { ok: true };

    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
    const { data: usage, error: usageError } = await serviceClient
      .from("agent_usage")
      .select("api_calls_count")
      .eq("owner_address", agent.owner_address.toLowerCase())
      .eq("period_start", periodStart)
      .maybeSingle();
    if (usageError) throw usageError;

    const used = (usage as { api_calls_count?: number } | null)?.api_calls_count ?? 0;
    return used >= maxCalls ? { ok: false, reason: "monthly_quota" } : { ok: true };
  } catch (error) {
    console.error("[rate-limit] monthly quota lookup failed:", error);
    return { ok: false, reason: "monthly_quota" };
  }
}

export async function incrementAgentMonthlyApiCall(serviceClient: any, ownerAddress: string): Promise<void> {
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
  const owner = ownerAddress.toLowerCase();

  const { data: existing, error: selectError } = await serviceClient
    .from("agent_usage")
    .select("id, api_calls_count")
    .eq("owner_address", owner)
    .eq("period_start", periodStart)
    .maybeSingle();
  if (selectError) {
    console.error("[rate-limit] monthly usage lookup failed:", selectError);
    return;
  }

  const row = existing as { id: string; api_calls_count?: number } | null;
  if (row) {
    const { error } = await serviceClient
      .from("agent_usage")
      .update({
        api_calls_count: (row.api_calls_count || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    if (error) console.error("[rate-limit] monthly usage update failed:", error);
    return;
  }

  const { error } = await serviceClient.from("agent_usage").insert({
    owner_address: owner,
    period_start: periodStart,
    period_end: periodEnd,
    api_calls_count: 1,
    mint_operations_count: 0,
    mint_total_amount: 0,
    fees_collected_usdc: 0,
  });
  if (error) console.error("[rate-limit] monthly usage insert failed:", error);
}
