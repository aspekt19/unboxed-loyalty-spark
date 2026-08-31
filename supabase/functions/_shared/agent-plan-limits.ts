/**
 * Plan entitlement enforcement for merchant (`lsk_`) agents.
 *
 * Two limits advertised on /pricing that used to be documentation-only:
 *  - `agent_plans.max_agents` — how many API keys one owner wallet may hold.
 *  - `agent_plans.max_mint_amount_monthly` — tokens an owner may mint per month
 *    (NULL = unlimited on Pro/Enterprise; Free is capped).
 *
 * Admin wallets (encrypted list in `admin-wallets.ts`) bypass every check —
 * same policy as the API rate limits.
 */

import { isAdminWallet } from "./admin-wallets.ts";

export type PlanLimits = {
  slug: string;
  maxAgents: number | null;
  maxMintMonthly: number | null;
};

const FREE_FALLBACK: PlanLimits = { slug: "free", maxAgents: 1, maxMintMonthly: 1000 };

async function loadPlanLimits(serviceClient: any, planId: string | null): Promise<PlanLimits> {
  const query = serviceClient.from("agent_plans").select("slug, max_agents, max_mint_amount_monthly");
  const { data } = planId
    ? await query.eq("id", planId).maybeSingle()
    : await query.eq("slug", "free").maybeSingle();

  const row = data as
    | { slug?: string; max_agents?: number | null; max_mint_amount_monthly?: number | string | null }
    | null;
  if (!row) return FREE_FALLBACK;

  return {
    slug: row.slug ?? "free",
    maxAgents: row.max_agents ?? null,
    maxMintMonthly:
      row.max_mint_amount_monthly === null || row.max_mint_amount_monthly === undefined
        ? null
        : Number(row.max_mint_amount_monthly),
  };
}

/** Plan of the owner, resolved from any of their agents' `plan_id`. */
export async function resolveOwnerPlanLimits(
  serviceClient: any,
  ownerAddress: string,
): Promise<PlanLimits> {
  const { data } = await serviceClient
    .from("agent_registry")
    .select("plan_id")
    .eq("owner_address", ownerAddress)
    .not("plan_id", "is", null)
    .limit(1)
    .maybeSingle();

  return await loadPlanLimits(serviceClient, (data as { plan_id?: string | null } | null)?.plan_id ?? null);
}

export async function resolveAgentPlanLimits(serviceClient: any, agentId: string): Promise<PlanLimits> {
  const { data } = await serviceClient
    .from("agent_registry")
    .select("plan_id")
    .eq("id", agentId)
    .maybeSingle();

  return await loadPlanLimits(serviceClient, (data as { plan_id?: string | null } | null)?.plan_id ?? null);
}

export type LimitCheck = { ok: true } | { ok: false; message: string; details: Record<string, unknown> };

/** Can this owner create one more API key? Existing keys over the cap keep working. */
export async function checkAgentSeatLimit(
  serviceClient: any,
  ownerAddress: string,
): Promise<LimitCheck> {
  if (await isAdminWallet(ownerAddress)) return { ok: true };

  const plan = await resolveOwnerPlanLimits(serviceClient, ownerAddress);
  // NULL and 0 both mean unlimited in plan metadata.
  if (plan.maxAgents === null || plan.maxAgents <= 0) return { ok: true };

  const { count } = await serviceClient
    .from("agent_registry")
    .select("id", { count: "exact", head: true })
    .eq("owner_address", ownerAddress);

  const current = count ?? 0;
  if (current < plan.maxAgents) return { ok: true };

  return {
    ok: false,
    message: `Your ${plan.slug} plan allows ${plan.maxAgents} agent${plan.maxAgents === 1 ? "" : "s"}. Upgrade to create more.`,
    details: { plan: plan.slug, max_agents: plan.maxAgents, current_agents: current },
  };
}

function currentPeriodStart(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().split("T")[0];
}

/** Would this mint exceed the owner's monthly mint allowance? */
export async function checkAgentMintQuota(
  serviceClient: any,
  agentId: string,
  ownerAddress: string,
  mintAmount: number,
): Promise<LimitCheck> {
  if (await isAdminWallet(ownerAddress)) return { ok: true };

  const plan = await resolveAgentPlanLimits(serviceClient, agentId);
  if (plan.maxMintMonthly === null) return { ok: true };

  const { data } = await serviceClient
    .from("agent_usage")
    .select("mint_total_amount")
    .eq("owner_address", ownerAddress.toLowerCase())
    .eq("period_start", currentPeriodStart())
    .maybeSingle();

  const used = Number((data as { mint_total_amount?: number | string | null } | null)?.mint_total_amount ?? 0);
  const remaining = plan.maxMintMonthly - used;
  if (mintAmount <= remaining) return { ok: true };

  return {
    ok: false,
    message: `Monthly mint cap reached: your ${plan.slug} plan allows ${plan.maxMintMonthly} tokens per month. Upgrade to mint more.`,
    details: {
      plan: plan.slug,
      max_mint_amount_monthly: plan.maxMintMonthly,
      minted_this_month: used,
      remaining: Math.max(0, remaining),
      requested: mintAmount,
    },
  };
}

export type MintQuotaResult =
  | { ok: true; counted: boolean }
  | { ok: false; message: string; details: Record<string, unknown> };

/** Atomically reserves this mint amount in the monthly usage row. */
export async function consumeAgentMintQuota(
  serviceClient: any,
  agentId: string,
  ownerAddress: string,
  mintAmount: number,
): Promise<MintQuotaResult> {
  if (await isAdminWallet(ownerAddress)) return { ok: true, counted: false };

  const plan = await resolveAgentPlanLimits(serviceClient, agentId);
  if (plan.maxMintMonthly === null) return { ok: true, counted: false };

  const { data, error } = await serviceClient.rpc("consume_agent_mint_quota", {
    p_agent_id: agentId,
    p_owner_address: ownerAddress,
    p_mint_amount: mintAmount,
  });

  if (error) {
    console.error("[plan-limits] mint quota RPC failed:", error);
    return {
      ok: false,
      message: "Unable to verify the monthly mint limit. Please retry.",
      details: { plan: plan.slug },
    };
  }

  if (data === true) return { ok: true, counted: true };

  return {
    ok: false,
    message: `Monthly mint cap reached: your ${plan.slug} plan allows ${plan.maxMintMonthly} tokens per month. Upgrade to mint more.`,
    details: { plan: plan.slug, max_mint_amount_monthly: plan.maxMintMonthly },
  };
}
