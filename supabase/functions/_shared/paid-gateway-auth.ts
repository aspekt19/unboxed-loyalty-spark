/** Internal header: set only by x402-gateway / mpp-gateway after successful per-request payment. */
export const PAID_GATEWAY_HEADER = "x-loyalspark-paid-gateway";

export type PaidGatewayKind = "x402" | "mpp";

/**
 * True when an internal gateway proxy settled per-request payment.
 * Ignores client-spoofed headers unless Authorization is the service role key.
 */
export function isPaidGatewayRequest(req: Request): boolean {
  const kind = req.headers.get(PAID_GATEWAY_HEADER)?.trim();
  if (kind !== "x402" && kind !== "mpp") return false;

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  if (!serviceKey) return false;

  const auth = req.headers.get("authorization")?.trim() ?? "";
  return auth === `Bearer ${serviceKey}`;
}

export function paidGatewayUpstreamHeaders(kind: PaidGatewayKind): Record<string, string> {
  return { [PAID_GATEWAY_HEADER]: kind };
}
