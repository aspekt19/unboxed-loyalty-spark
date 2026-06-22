/**
 * Recipient MCP tools for x402 Bazaar (resource = recipient-mcp-tools/<name>).
 * Keep in sync with supabase/functions/recipient-loyalty-mcp/index.ts mcpServer.tool registrations.
 *
 * Default tool price matches merchant MCP bazaar (mcp-bazaar-tools.ts P = 0.01).
 * prepare_loyalty_token_transfer matches merchant transfer REST ($0.005).
 */

import {
  BAZAAR_ADDR,
  BAZAAR_EMPTY_INPUT,
  BAZAAR_LOYAL_CODE,
  BAZAAR_TX_HASH,
  BAZAAR_UUID,
} from "./mcp-bazaar-schemas.ts";

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
  {
    name: "get_recipient_profile",
    price: P,
    description: "Recipient agent profile bound to rwk_ API key: wallet address, key scopes, and registration metadata.",
    inputSchema: BAZAAR_EMPTY_INPUT,
  },
  {
    name: "list_my_loyalty_balances",
    price: P,
    description: "All loyalty token balances and tier levels for the holder wallet linked to this rwk_ key.",
    inputSchema: BAZAAR_EMPTY_INPUT,
  },
  {
    name: "get_my_loyalty_balance",
    price: P,
    description: "Balance and tier for one loyalty program token held by the authenticated recipient wallet.",
    inputSchema: {
      type: "object",
      properties: {
        token_address: { ...BAZAAR_ADDR, description: "Loyalty program ERC-20 contract on Base." },
      },
      required: ["token_address"],
    },
  },
  {
    name: "prepare_loyalty_token_transfer",
    price: TRANSFER_PREP,
    description: "Build ERC-20 transfer calldata for the holder wallet to send loyalty tokens to any address (submit tx locally).",
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
    name: "list_rewards_for_program",
    price: P,
    description: "List active rewards you can redeem for a program where your wallet has loyalty activity or balance.",
    inputSchema: {
      type: "object",
      properties: {
        token_address: { ...BAZAAR_ADDR, description: "Loyalty program token contract." },
      },
      required: ["token_address"],
    },
  },
  {
    name: "list_my_vouchers",
    price: P,
    description: "List vouchers issued to your wallet (active, used, expired) across enrolled loyalty programs.",
    inputSchema: BAZAAR_EMPTY_INPUT,
  },
  {
    name: "redeem_my_reward",
    price: P,
    description: "Redeem a reward into an active voucher after paying the token cost on-chain (requires transfer tx hash).",
    inputSchema: {
      type: "object",
      properties: {
        reward_id: { ...BAZAAR_UUID, description: "Reward UUID from list_rewards_for_program." },
        transaction_hash: { ...BAZAAR_TX_HASH, description: "On-chain transfer tx paying the reward token cost." },
      },
      required: ["reward_id", "transaction_hash"],
    },
  },
  {
    name: "list_p2p_offers",
    price: P2P_LIST,
    description: "List open peer-to-peer token swap offers; optional filter by loyalty token (same price band as merchant GET /offers).",
    inputSchema: {
      type: "object",
      properties: {
        token_address: { ...BAZAAR_ADDR, description: "Optional filter: offers involving this token." },
      },
    },
  },
  {
    name: "create_p2p_offer",
    price: P,
    description: "Create a P2P swap intent: offer loyalty tokens in exchange for another ERC-20 amount.",
    inputSchema: {
      type: "object",
      properties: {
        offer_token_address: { ...BAZAAR_ADDR, description: "Token you are offering." },
        offer_amount: { type: "number", description: "Amount of offer token (whole units)." },
        request_token_address: { ...BAZAAR_ADDR, description: "Token you want in return." },
        request_amount: { type: "number", description: "Amount of request token (whole units)." },
      },
      required: ["offer_token_address", "offer_amount", "request_token_address", "request_amount"],
    },
  },
  {
    name: "accept_p2p_offer",
    price: P,
    description: "Accept another holder's P2P offer and record the match in Loyal Spark.",
    inputSchema: {
      type: "object",
      properties: {
        offer_id: { ...BAZAAR_UUID, description: "P2P offer UUID from list_p2p_offers." },
      },
      required: ["offer_id"],
    },
  },
  {
    name: "cancel_p2p_offer",
    price: "0.005",
    description: "Cancel a P2P offer you created before it is accepted.",
    inputSchema: {
      type: "object",
      properties: {
        offer_id: { ...BAZAAR_UUID, description: "P2P offer UUID to cancel." },
      },
      required: ["offer_id"],
    },
  },
  {
    name: "lookup_gift_certificate",
    price: P,
    description: "Preview a gift certificate by LOYAL-XXXXXX code without claiming (face value, expiry, program).",
    inputSchema: {
      type: "object",
      properties: {
        code: { ...BAZAAR_LOYAL_CODE, description: "Gift certificate code (LOYAL-XXXX-XXXX)." },
      },
      required: ["code"],
    },
  },
  {
    name: "claim_gift_certificate",
    price: P,
    description: "Claim an active gift certificate; binds it to your wallet (status active → pending_mint).",
    inputSchema: {
      type: "object",
      properties: {
        code: { ...BAZAAR_LOYAL_CODE, description: "Gift certificate code to claim." },
      },
      required: ["code"],
    },
  },
  {
    name: "list_my_gift_certificates",
    price: P,
    description: "List gift certificates claimed by your wallet with optional status filter.",
    inputSchema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["active", "pending_mint", "redeemed", "revoked", "expired"],
          description: "Filter by certificate lifecycle status.",
        },
        limit: { type: "number", description: "Max rows to return (default 50)." },
      },
    },
  },
];

const byName = new Map(RECIPIENT_MCP_BAZAAR_TOOLS.map((t) => [t.name, t] as const));

export function getRecipientMcpBazaarTool(toolName: string): RecipientMcpBazaarTool | undefined {
  return byName.get(toolName);
}

export function isRecipientMcpToolResource(resource: string): boolean {
  return resource.startsWith("recipient-mcp-tools/") && getRecipientMcpBazaarTool(resource.slice("recipient-mcp-tools/".length)) !== undefined;
}
