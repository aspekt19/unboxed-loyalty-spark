/**
 * Shared JSON Schema field fragments for MCP x402 Bazaar discovery.
 * Used by mcp-bazaar-tools.ts and recipient-mcp-bazaar-tools.ts only — does not affect pricing or resource URLs.
 */

export const BAZAAR_ADDR = {
  type: "string",
  pattern: "^0x[a-fA-F0-9]{40}$",
  description: "EVM address on Base mainnet (eip155:8453).",
} as const;

export const BAZAAR_TX_HASH = {
  type: "string",
  pattern: "^0x[a-fA-F0-9]{64}$",
  description: "Base mainnet transaction hash (32-byte hex).",
} as const;

export const BAZAAR_UUID = {
  type: "string",
  format: "uuid",
  description: "Loyal Spark resource UUID.",
} as const;

export const BAZAAR_LOYAL_CODE = {
  type: "string",
  description: "Gift certificate or voucher code (e.g. LOYAL-XXXX-XXXX).",
} as const;

/** MCP tools with no arguments. */
export const BAZAAR_EMPTY_INPUT = {
  type: "object",
  properties: {},
} as const;
