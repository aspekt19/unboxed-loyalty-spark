import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  appendBuilderCode,
  BUILDER_CODE,
  computeMintFeeAmount,
  encodeMintCalldata,
  encodeTransferCalldata,
  getAgentFeePercent,
  PLATFORM_FEE_WALLET,
} from "../_shared/loyalspark-agent-helpers.ts";
import {
  checkAgentApiRateLimits,
  incrementAgentMonthlyApiCall,
  type AgentRateLimitOptions,
} from "../_shared/agent-rate-limit.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

export function db() { return createClient(supabaseUrl, supabaseServiceKey); }

export {
  appendBuilderCode,
  BUILDER_CODE,
  computeMintFeeAmount,
  encodeMintCalldata,
  encodeTransferCalldata,
  getAgentFeePercent,
  PLATFORM_FEE_WALLET,
};
export const FACTORY_ADDRESS = "0x5F3DdBa12580CFdc6016258774cCc19C4250dA80";

export const SELECTORS = {
  createLoyaltyToken: "0x800e675c",
  unpauseUtility: "0x5073766d",
  enableMinting: "0xe797ec1b",
  pauseUtility: "0xe7911074",
  disableMinting: "0x7e5cd5c1",
};

export function encodeCreateLoyaltyTokenCalldata(name: string, symbol: string, merchantAddress: string): string {
  const paddedAddr = merchantAddress.toLowerCase().replace("0x", "").padStart(64, "0");
  const nameBytes = new TextEncoder().encode(name);
  const symbolBytes = new TextEncoder().encode(symbol);
  const nameHex = Array.from(nameBytes).map(b => b.toString(16).padStart(2, "0")).join("");
  const symbolHex = Array.from(symbolBytes).map(b => b.toString(16).padStart(2, "0")).join("");
  const namePadded = nameHex.padEnd(Math.ceil(nameHex.length / 64) * 64, "0");
  const symbolPadded = symbolHex.padEnd(Math.ceil(symbolHex.length / 64) * 64, "0");
  const nameDataLen = 32 + namePadded.length / 2;
  const nameOffset = (96).toString(16).padStart(64, "0");
  const symbolOffset = (96 + nameDataLen).toString(16).padStart(64, "0");
  const nameLenHex = nameBytes.length.toString(16).padStart(64, "0");
  const symbolLenHex = symbolBytes.length.toString(16).padStart(64, "0");
  return appendBuilderCode(SELECTORS.createLoyaltyToken + nameOffset + symbolOffset + paddedAddr + nameLenHex + namePadded + symbolLenHex + symbolPadded);
}

export function encodeNoArgCalldata(selector: string): string {
  return appendBuilderCode(selector);
}

export async function hashApiKey(key: string): Promise<string> {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(key));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

export type McpAgentContext = {
  agentId: string;
  ownerAddress: string;
  scopes: string[];
  name: string;
};

export type AuthenticateMcpAgentResult =
  | { ok: true; agent: McpAgentContext }
  | { ok: false; reason: "invalid_key" | "rate_limited" };

export async function authenticateAgent(
  apiKey: string,
  options?: AgentRateLimitOptions,
): Promise<AuthenticateMcpAgentResult> {
  const d = db();
  const keyHash = await hashApiKey(apiKey);
  const { data: agent, error } = await d
    .from("agent_registry")
    .select(
      "id, owner_address, scopes, name, is_active, total_requests, plan_id, rate_limit_per_minute"
    )
    .eq("api_key_hash", keyHash)
    .single();
  if (error || !agent || !agent.is_active) return { ok: false, reason: "invalid_key" };

  const limits = await checkAgentApiRateLimits(d, {
    id: agent.id,
    owner_address: agent.owner_address,
    rate_limit_per_minute: agent.rate_limit_per_minute,
    plan_id: agent.plan_id ?? null,
  }, options);
  if (!limits.ok) return { ok: false, reason: "rate_limited" };

  if (!options?.skipMonthlyQuota) {
    await incrementAgentMonthlyApiCall(d, agent.owner_address);
  }

  await d
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
