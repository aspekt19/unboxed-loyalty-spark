/**
 * Per-agent per-minute limits (agent_activity_log) and per-owner monthly API caps (agent_plans + agent_usage).
 */

/** Admin wallets get unlimited API access (no rate limits). */
const ADMIN_WALLETS = [
  "0x5cc0aa9ed773f413f81f78a62f2e94109ce26205",
  "0x40a8cdd6a10ec1a8cb3dfb2834675e7a2cf4ad8b",
];

export type AgentRateLimitRow = {
  id: string;
  owner_address: string;
  rate_limit_per_minute: number | null;
  plan_id: string | null;
};

export type RateLimitResult =
  | { ok: true }
  | { ok: false; reason: "per_minute" | "monthly_quota" };

async function resolveMonthlyMaxApiCalls(serviceClient: any, planId: string | null): Promise<number | null> {
  if (planId) {
    const { data: plan } = await serviceClient
      .from("agent_plans")
      .select("max_api_calls_monthly")
      .eq("id", planId)
      .single();
    const p = plan as { max_api_calls_monthly?: number | null } | null;
    return p?.max_api_calls_monthly ?? null;
  }
  const { data: free } = await serviceClient
    .from("agent_plans")
    .select("max_api_calls_monthly")
    .eq("slug", "free")
    .single();
  const f = free as { max_api_calls_monthly?: number | null } | null;
  return f?.max_api_calls_monthly ?? 100;
}

/** Fails if usage already at or over limits (before incrementing this request). */
export async function checkAgentApiRateLimits(
  serviceClient: any,
  agent: AgentRateLimitRow
): Promise<RateLimitResult> {
  // Admin wallets bypass all rate limits
  if (ADMIN_WALLETS.includes(agent.owner_address.toLowerCase())) {
    return { ok: true };
  }

  const perMin = agent.rate_limit_per_minute ?? 60;
  const sinceIso = new Date(Date.now() - 60_000).toISOString();

  const { count, error: cErr } = await serviceClient
    .from("agent_activity_log")
    .select("*", { count: "exact", head: true })
    .eq("agent_id", agent.id)
    .gte("created_at", sinceIso);

  if (cErr) console.error("[rate-limit] activity count error:", cErr);
  if (count !== null && count >= perMin) {
    return { ok: false, reason: "per_minute" };
  }

  const maxCalls = await resolveMonthlyMaxApiCalls(serviceClient, agent.plan_id);
  if (maxCalls === null) return { ok: true };

  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const owner = agent.owner_address.toLowerCase();

  const { data: usage } = await serviceClient
    .from("agent_usage")
    .select("api_calls_count")
    .eq("owner_address", owner)
    .eq("period_start", periodStart)
    .maybeSingle();

  const used = (usage as { api_calls_count?: number } | null)?.api_calls_count ?? 0;
  if (used >= maxCalls) return { ok: false, reason: "monthly_quota" };

  return { ok: true };
}

export async function incrementAgentMonthlyApiCall(serviceClient: any, ownerAddress: string): Promise<void> {
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
  const owner = ownerAddress.toLowerCase();

  const { data: existing } = await serviceClient
    .from("agent_usage")
    .select("id, api_calls_count")
    .eq("owner_address", owner)
    .eq("period_start", periodStart)
    .maybeSingle();

  const ex = existing as { id: string; api_calls_count?: number } | null;
  if (ex) {
    await serviceClient
      .from("agent_usage")
      .update({
        api_calls_count: (ex.api_calls_count || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", ex.id);
  } else {
    await serviceClient.from("agent_usage").insert({
      owner_address: owner,
      period_start: periodStart,
      period_end: periodEnd,
      api_calls_count: 1,
      mint_operations_count: 0,
      mint_total_amount: 0,
      fees_collected_usdc: 0,
    });
  }
}
