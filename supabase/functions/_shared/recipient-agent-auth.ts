import {
  checkAgentApiRateLimits,
  type AgentRateLimitOptions,
} from "./agent-rate-limit.ts";

export interface RecipientAgentContext {
  agentId: string;
  walletAddress: string;
  name: string;
}

export type RecipientAuthResult =
  | { ok: true; agent: RecipientAgentContext }
  | { ok: false; error: "invalid_key" }
  | { ok: false; error: "rate_limited"; reason: "per_minute" | "monthly_quota" };

export async function hashRecipientApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function authenticateRecipientAgent(
  apiKey: string,
  serviceClient: any,
  options?: AgentRateLimitOptions,
): Promise<RecipientAuthResult> {
  if (!apiKey?.startsWith("rwk_")) {
    return { ok: false, error: "invalid_key" };
  }

  const keyHash = await hashRecipientApiKey(apiKey);

  const { data: row, error } = await serviceClient
    .from("recipient_agent_registry")
    .select("id, wallet_address, name, is_active, rate_limit_per_minute, total_requests")
    .eq("api_key_hash", keyHash)
    .single();

  if (error || !row || !row.is_active) {
    return { ok: false, error: "invalid_key" };
  }

  const wallet = String(row.wallet_address).toLowerCase();

  const limits = await checkAgentApiRateLimits(serviceClient, {
    id: row.id,
    owner_address: wallet,
    rate_limit_per_minute: row.rate_limit_per_minute,
    plan_id: null,
  }, { ...options, activityTable: "recipient_agent_activity_log" });
  if (!limits.ok) {
    return { ok: false, error: "rate_limited", reason: limits.reason };
  }

  const prevReq = Number(row.total_requests) || 0;
  await serviceClient
    .from("recipient_agent_registry")
    .update({
      total_requests: prevReq + 1,
      last_request_at: new Date().toISOString(),
    })
    .eq("id", row.id);

  return {
    ok: true,
    agent: {
      agentId: row.id,
      walletAddress: wallet,
      name: row.name,
    },
  };
}

export async function insertRecipientActivity(
  serviceClient: any,
  agentId: string,
  action: string,
  requestBody: unknown,
  responseStatus: number,
  responseBody: unknown,
  ip?: string
): Promise<void> {
  await serviceClient.from("recipient_agent_activity_log").insert({
    agent_id: agentId,
    action,
    request_body: requestBody,
    response_status: responseStatus,
    response_body: responseBody,
    ip_address: ip || null,
  });
}
