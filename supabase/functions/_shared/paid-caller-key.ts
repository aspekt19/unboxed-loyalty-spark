/**
 * Paid x402/MPP calls need the merchant or holder key, except the public reads
 * listed in keyless-paid-routes.ts. The key says whose programs the call may
 * touch. Payment is the fee, not a substitute for that key.
 *
 * Check the key before settlement on every route that needs one. A missing or
 * dead key must return 401 with no charge. Discovery requests that carry no
 * payment credential stay on 402.
 */
import { hashApiKey } from "./agent-auth.ts";
import { resolveMcpApiKey } from "./mcp-http-api-key.ts";

export type CallerKeyTable = "agent_registry" | "recipient_agent_registry";

export type CallerKeyProblem = {
  status: 401 | 503;
  code: "missing_key" | "invalid_key" | "key_check_unavailable";
  error: string;
};

/** True when the row exists and is_active. False when absent or inactive. Null when the lookup itself failed. */
export type ActiveKeyLookup = (table: CallerKeyTable, keyHash: string) => Promise<boolean | null>;

export function callerKeyPrefix(resource: string): "lsk_" | "rwk_" {
  if (resource.startsWith("recipient-api/") || resource.startsWith("recipient-mcp-tools/")) return "rwk_";
  return "lsk_";
}

export function readPaidCallerKey(
  get: (name: string) => string | undefined,
  resource: string,
): string | undefined {
  return resolveMcpApiKey(get, callerKeyPrefix(resource));
}

/** Whatever token the caller sent, including a key with the wrong prefix. */
function presentedCallerKey(get: (name: string) => string | undefined): string | undefined {
  const x = get("x-api-key")?.trim();
  if (x) return x;
  const auth = get("authorization")?.trim() ?? "";
  if (/^bearer\s+/i.test(auth)) {
    const token = auth.slice(7).trim();
    if (token) return token;
  }
  return undefined;
}

/** True when this request is a paid retry, not the unpaid 402 discovery probe. */
export function requestCarriesPaymentCredential(get: (name: string) => string | undefined): boolean {
  for (const name of ["x-payment", "payment-signature", "x-mpp-payment"]) {
    if (get(name)?.trim()) return true;
  }
  const auth = get("authorization")?.trim() ?? "";
  return /^payment\s+/i.test(auth);
}

export function callerKeyShapeProblem(resource: string, key: string | undefined): CallerKeyProblem | null {
  const prefix = callerKeyPrefix(resource);
  const which = prefix === "lsk_" ? "merchant lsk_" : "holder rwk_";
  if (!key) {
    return {
      status: 401,
      code: "missing_key",
      error: `Missing API key. Send x-api-key: ${prefix}... or Authorization: Bearer ${prefix}... together with the payment. This route needs a ${which} key. The request is not charged.`,
    };
  }
  if (!key.startsWith(prefix)) {
    return {
      status: 401,
      code: "invalid_key",
      error: `Invalid API key. This route needs a ${which} key. The request is not charged.`,
    };
  }
  return null;
}

export async function paidCallerProblem(
  get: (name: string) => string | undefined,
  resource: string,
  lookup: ActiveKeyLookup,
): Promise<CallerKeyProblem | null> {
  const key = presentedCallerKey(get);
  const shape = callerKeyShapeProblem(resource, key);
  if (shape) return shape;

  const table: CallerKeyTable = callerKeyPrefix(resource) === "rwk_"
    ? "recipient_agent_registry"
    : "agent_registry";
  let active: boolean | null;
  try {
    active = await lookup(table, await hashApiKey(key!));
  } catch {
    active = null;
  }
  if (active === null) {
    return {
      status: 503,
      code: "key_check_unavailable",
      error: "Could not check the API key. The request is not charged. Retry shortly.",
    };
  }
  if (!active) {
    return {
      status: 401,
      code: "invalid_key",
      error: "Invalid API key or agent is deactivated. The request is not charged.",
    };
  }
  return null;
}

export const lookupActiveCallerKey: ActiveKeyLookup = async (table, keyHash) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  if (!supabaseUrl || !serviceKey) return null;
  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
  const client = createClient(supabaseUrl, serviceKey);
  const { data, error } = await client.from(table).select("is_active").eq("api_key_hash", keyHash).maybeSingle();
  if (error) return null;
  if (!data) return false;
  return (data as { is_active?: boolean }).is_active === true;
};

export function paidCallerRejectionResponse(
  problem: CallerKeyProblem,
  cors: Record<string, string>,
): Response {
  return new Response(JSON.stringify({ error: problem.error, code: problem.code, charged: false }), {
    status: problem.status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
