/** MCP tool ids for `supabase/functions/recipient-loyalty-mcp/index.ts`. */
export const RECIPIENT_MCP_TOOL_NAMES = [
  "get_recipient_profile",
  "list_my_loyalty_balances",
  "get_my_loyalty_balance",
  "prepare_loyalty_token_transfer",
  "list_rewards_for_program",
  "get_reward_workflow_status",
  "prepare_reward_redemption",
  "list_my_vouchers",
  "redeem_my_reward",
  "list_p2p_offers",
  "create_p2p_offer",
  "accept_p2p_offer",
  "cancel_p2p_offer",
  "lookup_gift_certificate",
  "claim_gift_certificate",
  "list_my_gift_certificates",
  "bazaar_discover_resources",
  "bazaar_discover_mcp_servers",
  "bazaar_probe_x402",
  "bazaar_pay_and_call",
] as const;

export const RECIPIENT_MCP_TOOL_COUNT = RECIPIENT_MCP_TOOL_NAMES.length;
