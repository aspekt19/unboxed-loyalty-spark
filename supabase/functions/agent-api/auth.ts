import {
  checkAgentApiRateLimits,
  incrementAgentMonthlyApiCall,
} from "../_shared/agent-rate-limit.ts";

export interface AgentContext {
  agentId: string;
  ownerAddress: string;
  scopes: string[];
  name: string;
}

export type AgentAuthResult =
  | { ok: true; agent: AgentContext }
  | { ok: false; error: "invalid_key" }
  | { ok: false; error: "rate_limited"; reason: "per_minute" | "monthly_quota" };

export async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function authenticateAgent(
  apiKey: string,
  serviceClient: any
): Promise<AgentAuthResult> {
  const keyHash = await hashApiKey(apiKey);

  const { data: agent, error } = await serviceClient
    .from("agent_registry")
    .select(
      "id, owner_address, scopes, name, is_active, rate_limit_per_minute, total_requests, last_request_at, plan_id"
    )
    .eq("api_key_hash", keyHash)
    .single();

  if (error || !agent || !agent.is_active) {
    return { ok: false, error: "invalid_key" };
  }

  const limits = await checkAgentApiRateLimits(serviceClient, {
    id: agent.id,
    owner_address: agent.owner_address,
    rate_limit_per_minute: agent.rate_limit_per_minute,
    plan_id: agent.plan_id ?? null,
  });

  if (!limits.ok) {
    return { ok: false, error: "rate_limited", reason: limits.reason };
  }

  await incrementAgentMonthlyApiCall(serviceClient, agent.owner_address);

  await serviceClient
    .from("agent_registry")
    .update({
      total_requests: (agent.total_requests || 0) + 1,
      last_request_at: new Date().toISOString(),
    })
    .eq("id", agent.id);

  return {
    ok: true,
    agent: {
      agentId: agent.id,
      ownerAddress: agent.owner_address,
      scopes: agent.scopes || ["read"],
      name: agent.name,
    },
  };
}
