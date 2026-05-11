/**
 * Recipient MCP tools for x402 Bazaar (resource = recipient-mcp-tools/<name>).
 * Keep in sync with supabase/functions/recipient-loyalty-mcp/index.ts mcpServer.tool registrations.
 *
 * Default tool price matches merchant MCP bazaar (mcp-bazaar-tools.ts P = 0.01).
 * prepare_loyalty_token_transfer matches merchant transfer REST ($0.005).
 */

export type RecipientMcpBazaarTool = {
  name: string;
  /** USD string e.g. "0.01" */
  price: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

const P = "0.01";
const TRANSFER_PREP = "0.005";
const P2P_LIST = "0.001";

export const RECIPIENT_MCP_BAZAAR_TOOLS: readonly RecipientMcpBazaarTool[] = [
  { name: "get_recipient_profile", price: P, description: "Recipient agent profile (rwk_ bound wallet)", inputSchema: { type: "object", properties: {} } },
  { name: "list_my_loyalty_balances", price: P, description: "All loyalty tier balances for your wallet", inputSchema: { type: "object", properties: {} } },
  { name: "get_my_loyalty_balance", price: P, description: "Balance and tier for one loyalty token", inputSchema: { type: "object", properties: { token_address: { type: "string" } }, required: ["token_address"] } },
  { name: "prepare_loyalty_token_transfer", price: TRANSFER_PREP, description: "ERC-20 transfer calldata; holder sends to any address (same band as merchant transfer)", inputSchema: { type: "object", properties: { token_address: { type: "string" }, to: { type: "string" }, amount: { type: "number" } }, required: ["token_address", "to", "amount"] } },
  { name: "list_rewards_for_program", price: P, description: "Redeemable rewards for a program you have activity on", inputSchema: { type: "object", properties: { token_address: { type: "string" } }, required: ["token_address"] } },
  { name: "list_my_vouchers", price: P, description: "Vouchers for your wallet", inputSchema: { type: "object", properties: {} } },
  { name: "redeem_my_reward", price: P, description: "Redeem reward with transfer tx hash", inputSchema: { type: "object", properties: { reward_id: { type: "string" }, transaction_hash: { type: "string" } }, required: ["reward_id", "transaction_hash"] } },
  { name: "list_p2p_offers", price: P2P_LIST, description: "List P2P offers (same band as GET /offers on merchant MPP)", inputSchema: { type: "object", properties: { token_address: { type: "string" } } } },
  { name: "create_p2p_offer", price: P, description: "Create P2P swap intent", inputSchema: { type: "object", properties: { offer_token_address: { type: "string" }, offer_amount: { type: "number" }, request_token_address: { type: "string" }, request_amount: { type: "number" } }, required: ["offer_token_address", "offer_amount", "request_token_address", "request_amount"] } },
  { name: "accept_p2p_offer", price: P, description: "Accept a P2P offer", inputSchema: { type: "object", properties: { offer_id: { type: "string" } }, required: ["offer_id"] } },
  { name: "cancel_p2p_offer", price: "0.005", description: "Cancel your P2P offer", inputSchema: { type: "object", properties: { offer_id: { type: "string" } }, required: ["offer_id"] } },
  { name: "lookup_gift_certificate", price: P, description: "Preview a gift certificate by code (LOYAL-XXXXXX) without claiming", inputSchema: { type: "object", properties: { code: { type: "string" } }, required: ["code"] } },
  { name: "claim_gift_certificate", price: P, description: "Claim an active gift certificate by code; binds it to your wallet (active → pending_mint)", inputSchema: { type: "object", properties: { code: { type: "string" } }, required: ["code"] } },
  { name: "list_my_gift_certificates", price: P, description: "List gift certificates claimed by your wallet", inputSchema: { type: "object", properties: { status: { type: "string" }, limit: { type: "number" } } } },
];

const byName = new Map(RECIPIENT_MCP_BAZAAR_TOOLS.map((t) => [t.name, t] as const));

export function getRecipientMcpBazaarTool(toolName: string): RecipientMcpBazaarTool | undefined {
  return byName.get(toolName);
}

export function isRecipientMcpToolResource(resource: string): boolean {
  return resource.startsWith("recipient-mcp-tools/") && getRecipientMcpBazaarTool(resource.slice("recipient-mcp-tools/".length)) !== undefined;
}
