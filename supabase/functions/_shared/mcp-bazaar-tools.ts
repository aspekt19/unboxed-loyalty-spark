/**
 * MCP tools exposed by loyalty-mcp for x402 Bazaar discovery (resource = mcp-tools/<name>).
 * Keep in sync with supabase/functions/loyalty-mcp/index.ts mcpServer.tool registrations.
 *
 * Recipient (buyer) MCP pricing: `recipient-mcp-bazaar-tools.ts` — resources `recipient-mcp-tools/<name>`.
 */

export type McpBazaarTool = {
  name: string;
  /** USD string e.g. "0.01" */
  price: string;
  description: string;
  /** JSON Schema for tool arguments (MCP Tool.inputSchema) */
  inputSchema: Record<string, unknown>;
};

/** Default pay-per-call for MCP tools via x402-gateway (align with MPP-style micropayments). */
const P = "0.01";

export const MCP_BAZAAR_TOOLS: readonly McpBazaarTool[] = [
  { name: "get_platform_info", price: P, description: "Protocol metadata and capabilities on Base L2", inputSchema: { type: "object", properties: {} } },
  { name: "get_my_profile", price: P, description: "Authenticated agent profile and scopes", inputSchema: { type: "object", properties: {} } },
  { name: "list_loyalty_programs", price: P, description: "List merchant loyalty programs", inputSchema: { type: "object", properties: { include_expired: { type: "boolean" } } } },
  { name: "create_loyalty_program", price: P, description: "Factory calldata to deploy ERC-20 loyalty token", inputSchema: { type: "object", properties: { name: { type: "string" }, symbol: { type: "string" }, expiration_days: { type: "number" } }, required: ["name", "symbol"] } },
  { name: "register_loyalty_program", price: P, description: "Register deployed token in database", inputSchema: { type: "object", properties: { name: { type: "string" }, symbol: { type: "string" }, token_address: { type: "string" } }, required: ["name", "symbol", "token_address"] } },
  { name: "activate_loyalty_program", price: P, description: "Activation calldata for inactive program", inputSchema: { type: "object", properties: { token_address: { type: "string" } }, required: ["token_address"] } },
  { name: "update_program_status", price: P, description: "Update program status in DB", inputSchema: { type: "object", properties: { token_address: { type: "string" }, status: { type: "string" } }, required: ["token_address", "status"] } },
  { name: "update_program_config", price: P, description: "Update program economics config", inputSchema: { type: "object", properties: { token_address: { type: "string" } }, required: ["token_address"] } },
  { name: "list_rewards", price: P, description: "List rewards for a program", inputSchema: { type: "object", properties: { token_address: { type: "string" } }, required: ["token_address"] } },
  { name: "create_reward", price: P, description: "Create redeemable reward", inputSchema: { type: "object", properties: { token_address: { type: "string" }, name: { type: "string" }, cost: { type: "number" } }, required: ["token_address", "name", "cost"] } },
  { name: "mint_loyalty_tokens", price: P, description: "Mint tokens + fee calldata (two txs)", inputSchema: { type: "object", properties: { token_address: { type: "string" }, recipient: { type: "string" }, amount: { type: "number" } }, required: ["token_address", "recipient", "amount"] } },
  { name: "transfer_loyalty_tokens", price: P, description: "Transfer loyalty tokens", inputSchema: { type: "object", properties: { token_address: { type: "string" }, to: { type: "string" }, amount: { type: "number" } }, required: ["token_address", "to", "amount"] } },
  { name: "earn_points", price: P, description: "Record earn / points for a customer", inputSchema: { type: "object", properties: { token_address: { type: "string" }, customer_address: { type: "string" }, amount: { type: "number" } }, required: ["token_address", "customer_address", "amount"] } },
  { name: "get_token_balance", price: P, description: "Balance and tier for a wallet", inputSchema: { type: "object", properties: { token_address: { type: "string" }, customer_address: { type: "string" } }, required: ["token_address", "customer_address"] } },
  { name: "get_program_analytics", price: P, description: "Program analytics", inputSchema: { type: "object", properties: { token_address: { type: "string" } }, required: ["token_address"] } },
  { name: "list_marketplace_offers", price: P, description: "List P2P offers", inputSchema: { type: "object", properties: { token_address: { type: "string" } }, required: ["token_address"] } },
  { name: "redeem_reward", price: P, description: "Redeem reward for voucher", inputSchema: { type: "object", properties: { reward_id: { type: "string" }, customer_address: { type: "string" }, transaction_hash: { type: "string" } }, required: ["reward_id", "customer_address", "transaction_hash"] } },
  { name: "use_voucher", price: P, description: "Mark voucher used", inputSchema: { type: "object", properties: { voucher_code: { type: "string" }, voucher_id: { type: "string" } } } },
  { name: "check_voucher_status", price: P, description: "Check voucher by code or id", inputSchema: { type: "object", properties: { voucher_code: { type: "string" }, voucher_id: { type: "string" } } } },
  { name: "get_platform_stats", price: P, description: "Admin: global platform statistics", inputSchema: { type: "object", properties: {} } },
  { name: "cancel_stale_offers", price: P, description: "Cancel stale marketplace offers", inputSchema: { type: "object", properties: { max_age_days: { type: "number" } } } },
  { name: "create_personalized_offer", price: P, description: "Create retention offer for a customer", inputSchema: { type: "object", properties: { token_address: { type: "string" }, customer_address: { type: "string" } }, required: ["token_address", "customer_address"] } },
  { name: "update_reward_status", price: P, description: "Activate/deactivate reward", inputSchema: { type: "object", properties: { reward_id: { type: "string" }, is_active: { type: "boolean" } }, required: ["reward_id"] } },
  { name: "send_report", price: P, description: "Submit agent report to merchant dashboard", inputSchema: { type: "object", properties: { agent_role: { type: "string" }, report_type: { type: "string" }, title: { type: "string" }, content: { type: "string" }, priority: { type: "string" }, action_items: { type: "array", items: { type: "string" } } }, required: ["agent_role", "report_type", "title", "content"] } },
  { name: "list_my_reports", price: P, description: "List agent reports", inputSchema: { type: "object", properties: {} } },
  { name: "update_report_status", price: P, description: "Update report status", inputSchema: { type: "object", properties: { report_id: { type: "string" }, status: { type: "string" } }, required: ["report_id", "status"] } },
  { name: "delete_report", price: P, description: "Delete a report", inputSchema: { type: "object", properties: { report_id: { type: "string" } }, required: ["report_id"] } },
  { name: "export_customers", price: P, description: "Export customers for a program", inputSchema: { type: "object", properties: { token_address: { type: "string" } }, required: ["token_address"] } },
];

const byName = new Map(MCP_BAZAAR_TOOLS.map((t) => [t.name, t] as const));

export function getMcpBazaarTool(toolName: string): McpBazaarTool | undefined {
  return byName.get(toolName);
}

export function isMcpToolResource(resource: string): boolean {
  return resource.startsWith("mcp-tools/") && getMcpBazaarTool(resource.slice("mcp-tools/".length)) !== undefined;
}
