/**
 * Paid gateway routes whose handler answers without a merchant, wallet, or scope.
 * On these routes a valid x402/MPP payment is enough; no lsk_/rwk_ key is required.
 * Every other paid route still needs a live key before settlement (paid-caller-key.ts).
 *
 * Keep this list to handlers that read only public data. Never add a route whose
 * handler resolves an owner address, wallet, or scope from the key.
 */
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

/** MCP tool names that may run keyless when the request was paid through a gateway. */
export const KEYLESS_MERCHANT_MCP_TOOLS: ReadonlySet<string> = new Set([
  "get_platform_info",
  "list_marketplace_offers",
]);
export const KEYLESS_RECIPIENT_MCP_TOOLS: ReadonlySet<string> = new Set(["list_p2p_offers"]);
