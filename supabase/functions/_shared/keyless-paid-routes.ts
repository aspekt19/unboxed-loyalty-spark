import { callerKeyPrefix } from "./paid-caller-key.ts";

/**
 * Paid gateway routes whose handler answers without a merchant, wallet, or scope.
 * On these routes a valid x402/MPP payment is enough; no lsk_/rwk_ key is required.
 * Every other paid route still needs a live key before settlement (paid-caller-key.ts).
 *
 * Keep this list to handlers that read only public data. Never add a route whose
 * handler resolves an owner address, wallet, or scope from the key.
 *
 * Do not send x-api-key on a keyless route. If a key is present, the upstream
 * checks it, so a dead key is charged and then rejected.
 */

export const KEYLESS_PAYMENT_INSTRUCTION =
  "Payment alone gives access; do not send an API key.";

/** One rule for catalogs, 402 probes, and public docs. Do not paraphrase. */
export const PAID_AUTH_RULE =
  "On x402 and MPP, send a live lsk_ (merchant) or rwk_ (holder) key on the same request as the payment. A payment without that live key is not charged. Five public reads accept the payment alone; do not send an API key on them: GET /offers and GET /recipient-api/offers on both x402-gateway and mpp-gateway, POST /x402-gateway/mcp-tools/get_platform_info, POST /x402-gateway/mcp-tools/list_marketplace_offers, and POST /x402-gateway/recipient-mcp-tools/list_p2p_offers.";
const KEYLESS: Record<string, ReadonlySet<string>> = {
  GET: new Set([
    "offers", // public marketplace list (marketplaceListOffers)
    "recipient-api/offers", // same public marketplace list
  ]),
  POST: new Set([
    "mcp-tools/get_platform_info", // static protocol info
    "mcp-tools/list_marketplace_offers", // public marketplace list
    "recipient-mcp-tools/list_p2p_offers", // public marketplace list
  ]),
};

export function paidRouteNeedsCallerKey(method: string, resource: string): boolean {
  const set = KEYLESS[method.toUpperCase()];
  return !(set && set.has(resource));
}

/** Sentence used in 402 bodies and discovery copy. Matches paidRouteNeedsCallerKey. */
export function paidRetryInstruction(method: string, resource: string): string {
  if (!paidRouteNeedsCallerKey(method, resource)) return KEYLESS_PAYMENT_INSTRUCTION;
  const prefix = callerKeyPrefix(resource);
  return `On the paid retry also send x-api-key: ${prefix}.... A payment without a live key is not charged.`;
}

/** MCP tool names that may run keyless when the request was paid through a gateway. */
export const KEYLESS_MERCHANT_MCP_TOOLS: ReadonlySet<string> = new Set([
  "get_platform_info",
  "list_marketplace_offers",
]);
export const KEYLESS_RECIPIENT_MCP_TOOLS: ReadonlySet<string> = new Set(["list_p2p_offers"]);
