/**
 * MCP tools exposed by loyalty-mcp for x402 Bazaar discovery (resource = mcp-tools/<name>).
 * Keep in sync with supabase/functions/loyalty-mcp/index.ts mcpServer.tool registrations.
 *
 * Recipient (buyer) MCP pricing: `recipient-mcp-bazaar-tools.ts` — resources `recipient-mcp-tools/<name>`.
 */

import {
  BAZAAR_ADDR,
  BAZAAR_EMPTY_INPUT,
  BAZAAR_LOYAL_CODE,
  BAZAAR_TX_HASH,
  BAZAAR_UUID,
} from "./mcp-bazaar-schemas.ts";

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
  {
    name: "get_platform_info",
    price: P,
    description: "Loyal Spark protocol metadata on Base L2: chain id, supported features (programs, rewards, vouchers, P2P, MCP), and API docs URL.",
    inputSchema: BAZAAR_EMPTY_INPUT,
  },
  {
    name: "get_my_profile",
    price: P,
    description: "Authenticated merchant agent profile: agent id, owner wallet, and API key scopes (read, mint, trade, manage_rewards, etc.).",
    inputSchema: BAZAAR_EMPTY_INPUT,
  },
  {
    name: "list_loyalty_programs",
    price: P,
    description: "List ERC-20 loyalty programs owned by the authenticated merchant; optionally include expired programs.",
    inputSchema: {
      type: "object",
      properties: {
        include_expired: { type: "boolean", description: "When true, include programs with status expired." },
      },
    },
  },
  {
    name: "create_loyalty_program",
    price: P,
    description: "Build factory calldata to deploy a new ERC-20 loyalty token on Base (submit txs from the merchant or agent wallet).",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Program display name (max 50 characters)." },
        symbol: { type: "string", description: "ERC-20 symbol (2–5 characters)." },
        expiration_days: { type: "number", description: "Program lifetime in days (default 365)." },
      },
      required: ["name", "symbol"],
    },
  },
  {
    name: "register_loyalty_program",
    price: P,
    description: "Register an already-deployed loyalty token in Loyal Spark (links on-chain contract to merchant dashboard).",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Program display name." },
        symbol: { type: "string", description: "ERC-20 symbol." },
        token_address: { ...BAZAAR_ADDR, description: "Deployed loyalty ERC-20 contract on Base." },
      },
      required: ["name", "symbol", "token_address"],
    },
  },
  {
    name: "activate_loyalty_program",
    price: P,
    description: "Build activation calldata for an inactive loyalty program (on-chain activate + DB status).",
    inputSchema: {
      type: "object",
      properties: {
        token_address: { ...BAZAAR_ADDR, description: "Loyalty program token contract." },
      },
      required: ["token_address"],
    },
  },
  {
    name: "update_program_status",
    price: P,
    description: "Update loyalty program status in the database (active, paused, expired, cancelled).",
    inputSchema: {
      type: "object",
      properties: {
        token_address: { ...BAZAAR_ADDR, description: "Loyalty program token contract." },
        status: {
          type: "string",
          enum: ["active", "paused", "expired", "cancelled"],
          description: "New program status.",
        },
      },
      required: ["token_address", "status"],
    },
  },
  {
    name: "update_program_config",
    price: P,
    description: "Update program economics: cashback rate, points per dollar, and related merchant settings.",
    inputSchema: {
      type: "object",
      properties: {
        token_address: { ...BAZAAR_ADDR, description: "Loyalty program token contract." },
        cashback_rate: { type: "number", description: "Cashback percentage of purchase amount (0–100)." },
        points_per_dollar: { type: "number", description: "Loyalty points earned per USD spent." },
      },
      required: ["token_address"],
    },
  },
  {
    name: "list_rewards",
    price: P,
    description: "List redeemable rewards configured for a loyalty program (name, cost in tokens, active flag).",
    inputSchema: {
      type: "object",
      properties: {
        token_address: { ...BAZAAR_ADDR, description: "Loyalty program token contract." },
      },
      required: ["token_address"],
    },
  },
  {
    name: "create_reward",
    price: P,
    description: "Create a new redeemable reward (customer pays token cost on-chain, then redeems for a voucher).",
    inputSchema: {
      type: "object",
      properties: {
        token_address: { ...BAZAAR_ADDR, description: "Loyalty program token contract." },
        name: { type: "string", description: "Reward title shown to customers." },
        description: { type: "string", description: "Optional reward description." },
        cost: { type: "number", description: "Token amount required to redeem (minimum 1)." },
      },
      required: ["token_address", "name", "cost"],
    },
  },
  {
    name: "mint_loyalty_tokens",
    price: P,
    description: "Build mint + platform fee calldata (two transactions) to issue loyalty tokens to a customer wallet.",
    inputSchema: {
      type: "object",
      properties: {
        token_address: { ...BAZAAR_ADDR, description: "Loyalty program token contract." },
        recipient: { ...BAZAAR_ADDR, description: "Customer wallet receiving minted tokens." },
        amount: { type: "number", description: "Whole-token amount to mint (human units, not wei)." },
      },
      required: ["token_address", "recipient", "amount"],
    },
  },
  {
    name: "transfer_loyalty_tokens",
    price: P,
    description: "Build ERC-20 transfer calldata to send loyalty tokens from the merchant or agent wallet to any address.",
    inputSchema: {
      type: "object",
      properties: {
        token_address: { ...BAZAAR_ADDR, description: "Loyalty program token contract." },
        to: { ...BAZAAR_ADDR, description: "Recipient wallet address." },
        amount: { type: "number", description: "Whole-token amount to transfer." },
      },
      required: ["token_address", "to", "amount"],
    },
  },
  {
    name: "earn_points",
    price: P,
    description: "Calculate and mint loyalty tokens from a purchase amount using the program cashback rate (earn / cashback flow).",
    inputSchema: {
      type: "object",
      properties: {
        token_address: { ...BAZAAR_ADDR, description: "Loyalty program token contract." },
        customer_address: { ...BAZAAR_ADDR, description: "Customer wallet to credit." },
        purchase_amount: { type: "number", description: "Purchase total in USD (fiat units)." },
        cashback_rate: { type: "number", description: "Optional override of program cashback % (0–100)." },
      },
      required: ["token_address", "customer_address", "purchase_amount"],
    },
  },
  {
    name: "get_token_balance",
    price: P,
    description: "Read a customer's loyalty token balance and tier level for a specific program.",
    inputSchema: {
      type: "object",
      properties: {
        token_address: { ...BAZAAR_ADDR, description: "Loyalty program token contract." },
        customer_address: { ...BAZAAR_ADDR, description: "Customer wallet to query." },
      },
      required: ["token_address", "customer_address"],
    },
  },
  {
    name: "get_program_analytics",
    price: P,
    description: "Aggregate program analytics: holders, mint volume, redemptions, and tier distribution for a merchant.",
    inputSchema: {
      type: "object",
      properties: {
        token_address: { ...BAZAAR_ADDR, description: "Loyalty program token contract." },
      },
      required: ["token_address"],
    },
  },
  {
    name: "list_marketplace_offers",
    price: P,
    description: "List open P2P token-swap offers for a loyalty program (peer-to-peer marketplace).",
    inputSchema: {
      type: "object",
      properties: {
        token_address: { ...BAZAAR_ADDR, description: "Filter offers involving this program token." },
      },
      required: ["token_address"],
    },
  },
  {
    name: "redeem_reward",
    price: P,
    description: "Redeem a reward for an active voucher after the customer paid the token cost on-chain (requires transfer tx hash).",
    inputSchema: {
      type: "object",
      properties: {
        reward_id: { ...BAZAAR_UUID, description: "Reward UUID from list_rewards." },
        customer_address: { ...BAZAAR_ADDR, description: "Customer wallet that paid the token cost." },
        transaction_hash: { ...BAZAAR_TX_HASH, description: "On-chain transfer tx proving token payment." },
      },
      required: ["reward_id", "customer_address", "transaction_hash"],
    },
  },
  {
    name: "use_voucher",
    price: P,
    description: "Mark an active voucher as used at checkout (merchant scans code or voucher id).",
    inputSchema: {
      type: "object",
      properties: {
        voucher_code: { ...BAZAAR_LOYAL_CODE, description: "Voucher code (LOYAL-XXXX-XXXX)." },
        voucher_id: { ...BAZAAR_UUID, description: "Voucher UUID (alternative to code)." },
      },
    },
  },
  {
    name: "check_voucher_status",
    price: P,
    description: "Look up voucher status (active, used, expired) by human-readable code or internal id.",
    inputSchema: {
      type: "object",
      properties: {
        voucher_code: { ...BAZAAR_LOYAL_CODE, description: "Voucher code (LOYAL-XXXX-XXXX)." },
        voucher_id: { ...BAZAAR_UUID, description: "Voucher UUID (alternative to code)." },
      },
    },
  },
  {
    name: "get_platform_stats",
    price: P,
    description: "Admin-only: global Loyal Spark platform statistics (programs, agents, volume). Requires elevated scope.",
    inputSchema: BAZAAR_EMPTY_INPUT,
  },
  {
    name: "cancel_stale_offers",
    price: P,
    description: "Bulk-cancel marketplace P2P offers older than max_age_days for the authenticated merchant.",
    inputSchema: {
      type: "object",
      properties: {
        max_age_days: { type: "number", description: "Cancel offers older than this many days (default 30)." },
      },
    },
  },
  {
    name: "create_personalized_offer",
    price: P,
    description: "Create a targeted retention P2P or bonus offer for a specific customer wallet.",
    inputSchema: {
      type: "object",
      properties: {
        token_address: { ...BAZAAR_ADDR, description: "Loyalty program token contract." },
        customer_address: { ...BAZAAR_ADDR, description: "Target customer wallet." },
      },
      required: ["token_address", "customer_address"],
    },
  },
  {
    name: "update_reward_status",
    price: P,
    description: "Activate or deactivate a reward without deleting it (controls visibility in customer apps).",
    inputSchema: {
      type: "object",
      properties: {
        reward_id: { ...BAZAAR_UUID, description: "Reward UUID." },
        is_active: { type: "boolean", description: "True to show reward; false to hide." },
      },
      required: ["reward_id"],
    },
  },
  {
    name: "send_report",
    price: P,
    description: "Submit a structured AI agent report to the merchant dashboard (insights, alerts, action items).",
    inputSchema: {
      type: "object",
      properties: {
        agent_role: { type: "string", description: "Agent persona label (e.g. analyst, support)." },
        report_type: { type: "string", description: "Report category (e.g. weekly_summary, churn_alert)." },
        title: { type: "string", description: "Short report headline." },
        content: { type: "string", description: "Markdown or plain-text report body." },
        priority: { type: "string", enum: ["low", "medium", "high"], description: "Merchant inbox priority." },
        action_items: { type: "array", items: { type: "string" }, description: "Suggested follow-up tasks." },
      },
      required: ["agent_role", "report_type", "title", "content"],
    },
  },
  {
    name: "list_my_reports",
    price: P,
    description: "List AI agent reports previously submitted by this merchant agent.",
    inputSchema: BAZAAR_EMPTY_INPUT,
  },
  {
    name: "update_report_status",
    price: P,
    description: "Update merchant workflow status on an agent report (open, in_progress, resolved).",
    inputSchema: {
      type: "object",
      properties: {
        report_id: { ...BAZAAR_UUID, description: "Report UUID." },
        status: { type: "string", description: "New status value." },
      },
      required: ["report_id", "status"],
    },
  },
  {
    name: "delete_report",
    price: P,
    description: "Permanently delete an agent report from the merchant dashboard.",
    inputSchema: {
      type: "object",
      properties: {
        report_id: { ...BAZAAR_UUID, description: "Report UUID." },
      },
      required: ["report_id"],
    },
  },
  {
    name: "export_customers",
    price: P,
    description: "Export customer list with balances and tiers for a loyalty program (CSV-ready JSON).",
    inputSchema: {
      type: "object",
      properties: {
        token_address: { ...BAZAAR_ADDR, description: "Loyalty program token contract." },
      },
      required: ["token_address"],
    },
  },
  {
    name: "create_gift_certificate",
    price: P,
    description: "Issue gift or welcome certificates (LOYAL-XXXXXX); single code or batch up to 100 per call.",
    inputSchema: {
      type: "object",
      properties: {
        token_address: { ...BAZAAR_ADDR, description: "Loyalty program token contract." },
        usd_amount: { type: "number", description: "Face value in USD for the certificate." },
        points_per_dollar: { type: "number", description: "Conversion rate when minting tokens." },
        max_redemption_percent: { type: "number", description: "Max % of order payable with certificate." },
        title: { type: "string", description: "Certificate title for UI." },
        description: { type: "string", description: "Certificate description for UI." },
        expires_in_days: { type: "number", description: "Validity period from creation." },
        image_url: { type: "string", description: "Optional image URL for wallet / email." },
        quantity: { type: "number", description: "Batch size (1–100, default 1)." },
      },
      required: ["token_address", "usd_amount"],
    },
  },
  {
    name: "list_gift_certificates",
    price: P,
    description: "List gift certificates issued by the authenticated merchant with optional status filter.",
    inputSchema: {
      type: "object",
      properties: {
        token_address: { ...BAZAAR_ADDR, description: "Filter by program token." },
        status: {
          type: "string",
          enum: ["active", "pending_mint", "redeemed", "revoked", "expired"],
          description: "Filter by certificate lifecycle status.",
        },
        limit: { type: "number", description: "Max rows to return (default 50)." },
      },
    },
  },
  {
    name: "revoke_gift_certificate",
    price: P,
    description: "Revoke an active gift certificate so it can no longer be claimed (active → revoked).",
    inputSchema: {
      type: "object",
      properties: {
        certificate_id: { ...BAZAAR_UUID, description: "Gift certificate UUID." },
      },
      required: ["certificate_id"],
    },
  },
  {
    name: "mark_gift_certificate_minted",
    price: P,
    description: "Finalize a claimed certificate after on-chain mint (pending_mint → redeemed); requires mint tx hash.",
    inputSchema: {
      type: "object",
      properties: {
        certificate_id: { ...BAZAAR_UUID, description: "Gift certificate UUID." },
        transaction_hash: { ...BAZAAR_TX_HASH, description: "On-chain mint transaction hash." },
      },
      required: ["certificate_id", "transaction_hash"],
    },
  },
];

const byName = new Map(MCP_BAZAAR_TOOLS.map((t) => [t.name, t] as const));

export function getMcpBazaarTool(toolName: string): McpBazaarTool | undefined {
  return byName.get(toolName);
}

export function isMcpToolResource(resource: string): boolean {
  return resource.startsWith("mcp-tools/") && getMcpBazaarTool(resource.slice("mcp-tools/".length)) !== undefined;
}
