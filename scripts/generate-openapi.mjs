/**
 * Regenerates public/openapi.json + public/.well-known/x402 in the format
 * required by x402scan Discovery Spec (https://www.x402scan.com/discovery):
 *
 * - Each paid OpenAPI operation has summary, description, requestBody schema (POST),
 *   responses.402 and `x-payment-info` with structured price + protocols (x402+mpp).
 * - Covers ALL paid resources: merchant REST (agent-api), recipient REST (recipient-api),
 *   ${MCP_TOOLS.length} merchant MCP tools (mcp-tools/<name>) and ${RECIPIENT_MCP_TOOLS.length} recipient MCP tools (recipient-mcp-tools/<name>).
 * - Static compat mirrors at public/.well-known/x402 (+ .json) on loyalspark.online; live Bazaar
 *   discovery origin for x402scan is api.loyalspark.online/.well-known/x402 (see PUBLIC_BASE_URL).
 * - openapi.json is hosted at loyalspark.online/openapi.json but servers[] lists only api.loyalspark.online
 *   (no supabase.co second server — avoids duplicate x402scan origin registration).
 *
 * Run: node scripts/generate-openapi.mjs
 */

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const PUBLIC_ORIGIN = "https://loyalspark.online";
const API_ORIGIN = "https://api.loyalspark.online";
const PUBLIC_GATEWAY_PATH = "/x402-gateway";
const GATEWAY = `${API_ORIGIN}${PUBLIC_GATEWAY_PATH}`;
const MCP_URL = `${API_ORIGIN}/loyalty-mcp`;
const RECIPIENT_MCP_URL = `${API_ORIGIN}/recipient-loyalty-mcp`;

// ---- Pricing tables (kept aligned with supabase/functions/_shared/*) ----

// Two-phase P2P accept body (kept in sync with supabase/functions/_shared/marketplace-p2p.ts)
const ACCEPT_OFFER_BODY = {
  type: "object",
  required: ["offer_id"],
  additionalProperties: true,
  description:
    "Two-phase: omit transaction_hash to reserve the offer (active -> accepted) and get approve + fillOffer escrow calldata; send transaction_hash of the confirmed fillOffer tx to finalize (accepted -> completed).",
  properties: {
    offer_id: { type: "string", format: "uuid", description: "Marketplace offer id." },
    onchain_offer_id: { type: "number", description: "On-chain escrow offer id (phase 1, when known)." },
    transaction_hash: {
      type: "string",
      pattern: "^0x[a-fA-F0-9]{64}$",
      description: "Phase 2: hash of the confirmed escrow fillOffer transaction on Base.",
    },
  },
};

const MERCHANT_REST = {
  GET: {
    "/me": { price: "0", auth: "lsk", summary: "Get agent profile, scopes, plan and wallet", desc: "Returns the merchant agent's profile (owner address, plan, API scopes, wallet metadata). Free: identity-only." },
    "/programs": { price: "0.001", auth: "lsk", summary: "List loyalty programs", desc: "Lists all loyalty programs owned by the authenticated merchant agent (active + expired)." },
    "/rewards": { price: "0.001", auth: "lsk", summary: "List rewards for a program", desc: "Returns the reward catalog for a given loyalty token (token_address required as query)." },
    "/balance": { price: "0.001", auth: "lsk", summary: "Get token balance and tier for a wallet", desc: "Returns ERC-20 balance, current tier, and tokens-earned-total for a customer wallet." },
    "/customers": { price: "0.002", auth: "lsk", summary: "List customers for a program", desc: "Returns customers (vouchers, balances, tier) of a given loyalty token." },
    "/vouchers": { price: "0.001", auth: "lsk", summary: "List vouchers issued by the merchant", desc: "Returns vouchers issued by the authenticated merchant; filterable by customer_address." },
    "/vouchers/status": { price: "0", auth: "none", summary: "Public voucher verification", desc: "Public endpoint: check whether a voucher code or id is valid, used or expired. No API key required." },
    "/analytics": { price: "0.005", auth: "lsk", summary: "Program analytics", desc: "Returns aggregated metrics for a loyalty token: minted, holders, redemptions, top customers, RFM distribution." },
    "/offers": { price: "0.001", auth: "lsk", summary: "List P2P marketplace offers", desc: "Returns active P2P swap offers across loyalty tokens (filterable by token_address)." },
    "/tx-receipt": { price: "0", auth: "lsk", summary: "Fetch transaction receipt", desc: "Fetches a Base L2 transaction receipt by hash. Free helper for agents tracking on-chain confirmations." },
    "/merchant-profile": { price: "0.001", auth: "lsk", summary: "Read merchant profile", desc: "Returns the merchant public profile (name, logo, description) for the authenticated agent owner." },
    "/workflow/program-status": { price: "0.001", auth: "lsk", summary: "Autonomous program workflow status", desc: "Returns the current merchant program lifecycle step and machine-readable next_actions[] for self-orchestration." },
  },
  POST: {
    "/programs": { price: "0.05", auth: "lsk", summary: "Get calldata to deploy a loyalty token", desc: "Default: B20 factory calldata (createB20 on 0xB20f…, one tx, active after register). Legacy: set token_standard erc20 for LoyaltyTokenFactory 0x5F3DdB… + activation. Agent broadcasts with its wallet (or /agent-wallet), then POST /register-program." },
    "/register-program": { price: "0.01", auth: "lsk", summary: "Register a deployed loyalty token in the database", desc: "Persists a deployed ERC-20 loyalty token (name, symbol, token_address, optional cashback_rate / points_per_dollar)." },
    "/update-program-config": { price: "0.005", auth: "lsk", summary: "Update default cashback / points-per-dollar", desc: "Updates the loyalty program economics (cashback_rate 0-50%, points_per_dollar). Owner agent only." },
    "/activate-program": { price: "0.01", auth: "lsk", summary: "Get activation calldata for an inactive program", desc: "Returns calldata to unpause a program and enable mint operations. Caller submits the on-chain tx." },
    "/program-status": { price: "0.005", auth: "lsk", summary: "Set program status in the database", desc: "Sets the database status (active / paused / archived) of a loyalty program." },
    "/rewards": { price: "0.01", auth: "lsk", summary: "Create a redeemable reward", desc: "Creates a reward in the merchant catalog (name, description, cost in points, optional stock and validity)." },
    "/mint": { price: "0.01", auth: "lsk", summary: "Mint loyalty tokens (fee-first calls[])", desc: "Returns a fee-first calls[] bundle (protocol fee mint first, then recipient) plus fee_obligation_id. The protocol fee is charged in the merchant's own loyalty tokens, not USDC, and is separate from this call's x402 price. Confirm with POST /agent-api/mint/confirm after broadcast; 5+ obligations unpaid for over 60 minutes block further mints with HTTP 402." },
    "/earn": { price: "0.01", auth: "lsk", summary: "Record an earn / cashback for a purchase", desc: "Computes and mints loyalty points for a purchase (uses program's cashback_rate and points_per_dollar). Same fee-first + confirm model as /mint." },
    "/transfer": { price: "0.005", auth: "lsk", summary: "Get transfer calldata for loyalty tokens", desc: "Returns ERC-20 transfer calldata for the merchant agent to move loyalty tokens." },
    "/redeem-reward": { price: "0.01", auth: "lsk", summary: "Redeem a reward for a customer", desc: "Burns reward cost from customer balance and issues a voucher; returns voucher code and id." },
    "/vouchers/use": { price: "0.005", auth: "lsk", summary: "Mark a voucher as used", desc: "Marks a previously-issued voucher as used (consumed at point-of-sale)." },
    "/offers": { price: "0.01", auth: "lsk", summary: "Create a P2P swap offer", desc: "Creates a P2P swap offer between two loyalty tokens (offer_token / offer_amount ↔ request_token / request_amount)." },
    "/accept-offer": { price: "0.01", auth: "lsk", summary: "Accept a P2P swap offer (two-phase)", desc: "Phase 1 (no transaction_hash): reserves the offer for your wallet (active -> accepted) and returns approve + fillOffer escrow calldata. Phase 2: call again with transaction_hash of the confirmed LoyaltyTokenEscrow fillOffer tx; the API verifies it on Base and sets the offer to completed.", body: ACCEPT_OFFER_BODY },
    "/cancel-offer": { price: "0.005", auth: "lsk", summary: "Cancel an own P2P swap offer", desc: "Cancels a P2P swap offer the caller created (status active only)." },
    "/merchant-profile": { price: "0.005", auth: "lsk", summary: "Create merchant profile", desc: "Creates the merchant public profile for the authenticated agent owner." },
    "/workflow/generate-program-defaults": { price: "0.001", auth: "lsk", summary: "Generate program defaults from business context", desc: "Autonomous planner: proposes program name, symbol, cashback economics, and starter rewards from merchant business context." },
  },
  PUT: {
    "/merchant-profile": { price: "0.005", auth: "lsk", summary: "Update merchant profile", desc: "Updates merchant profile fields for the authenticated agent owner." },
  },
};

const RECIPIENT_REST = {
  GET: {
    "/recipient-api/me": { price: "0", summary: "Get recipient agent profile", desc: "Returns the recipient (holder) agent profile bound to its wallet (rwk_ key)." },
    "/recipient-api/balances": { price: "0.001", summary: "List all loyalty balances for the holder", desc: "Returns balances and tiers across every loyalty program the holder participates in." },
    "/recipient-api/balance": { price: "0.001", summary: "Get balance for one loyalty token", desc: "Returns balance and tier for the holder for a single loyalty token." },
    "/recipient-api/rewards": { price: "0.001", summary: "List rewards available to the holder", desc: "Lists redeemable rewards in programs where the holder has activity." },
    "/recipient-api/vouchers": { price: "0.001", summary: "List vouchers issued to the holder", desc: "Returns the holder's vouchers (redeemed rewards) with status." },
    "/recipient-api/offers": { price: "0.001", summary: "List P2P marketplace offers visible to the holder", desc: "Lists P2P swap offers the holder can accept (filterable by token_address)." },
    "/recipient-api/workflow/reward-status": { price: "0.001", summary: "Autonomous reward redemption status", desc: "Returns the current reward redemption step and machine-readable next_actions[] for the holder." },
  },
  POST: {
    "/recipient-api/register": { price: "0", summary: "Register / refresh the recipient profile", desc: "Idempotent: refreshes recipient profile metadata. Free." },
    "/recipient-api/prepare-transfer": { price: "0.005", summary: "Prepare ERC-20 transfer calldata", desc: "Returns ERC-20 transfer calldata for the holder to send loyalty tokens to any address." },
    "/recipient-api/redeem-reward": { price: "0.01", summary: "Redeem a reward", desc: "Redeems a reward using a transfer tx hash; returns the issued voucher." },
    "/recipient-api/offers": { price: "0.01", summary: "Create P2P swap offer", desc: "Creates a P2P swap intent between two loyalty tokens." },
    "/recipient-api/accept-offer": { price: "0.01", summary: "Accept a P2P swap offer (two-phase)", desc: "Phase 1 (no transaction_hash): reserves the offer (active -> accepted) and returns approve + fillOffer escrow calldata. Phase 2: call again with transaction_hash of the confirmed fillOffer tx to finalize (accepted -> completed).", body: ACCEPT_OFFER_BODY },
    "/recipient-api/cancel-offer": { price: "0.005", summary: "Cancel own P2P swap offer", desc: "Cancels a P2P swap offer created by the holder." },
    "/recipient-api/workflow/prepare-reward-redemption": { price: "0.005", summary: "Prepare reward redemption plan + transfer calldata", desc: "One-shot planner: returns ERC-20 transfer calldata for the reward cost plus workflow so the agent can broadcast then redeem." },
  },
};

// MCP tools — keep in sync with supabase/functions/_shared/mcp-bazaar-tools.ts
const MCP_TOOLS = [
  ["get_platform_info", "0.01", "Protocol metadata and capabilities on Base L2", {}],
  ["get_my_profile", "0.01", "Authenticated agent profile and scopes", {}],
  ["list_loyalty_programs", "0.01", "List merchant loyalty programs", { include_expired: { type: "boolean" } }],
  ["create_loyalty_program", "0.01", "Factory calldata to deploy ERC-20 loyalty token", { name: { type: "string" }, symbol: { type: "string" }, expiration_days: { type: "number" } }, ["name", "symbol"]],
  ["register_loyalty_program", "0.01", "Register deployed token in database", { name: { type: "string" }, symbol: { type: "string" }, token_address: { type: "string" } }, ["name", "symbol", "token_address"]],
  ["activate_loyalty_program", "0.01", "Activation calldata for inactive program", { token_address: { type: "string" } }, ["token_address"]],
  ["update_program_status", "0.01", "Update program status in DB", { token_address: { type: "string" }, status: { type: "string" } }, ["token_address", "status"]],
  ["update_program_config", "0.01", "Update program economics config (cashback_rate, points_per_dollar)", { token_address: { type: "string" }, cashback_rate: { type: "number" }, points_per_dollar: { type: "number" } }, ["token_address"]],
  ["list_rewards", "0.01", "List rewards for a program", { token_address: { type: "string" } }, ["token_address"]],
  ["create_reward", "0.01", "Create redeemable reward", { token_address: { type: "string" }, name: { type: "string" }, cost: { type: "number" } }, ["token_address", "name", "cost"]],
  ["mint_loyalty_tokens", "0.01", "Fee-first mint calls[] (protocol fee first) + fee_obligation_id; confirm via confirm_mint_fee / POST /mint/confirm", { token_address: { type: "string" }, recipient: { type: "string" }, amount: { type: "number" } }, ["token_address", "recipient", "amount"]],
  ["transfer_loyalty_tokens", "0.01", "Transfer loyalty tokens", { token_address: { type: "string" }, to: { type: "string" }, amount: { type: "number" } }, ["token_address", "to", "amount"]],
  ["earn_points", "0.01", "Record earn / points for a customer purchase (fee-first + confirm)", { token_address: { type: "string" }, customer_address: { type: "string" }, amount: { type: "number" } }, ["token_address", "customer_address", "amount"]],
  ["get_token_balance", "0.01", "Balance and tier for a wallet", { token_address: { type: "string" }, customer_address: { type: "string" } }, ["token_address", "customer_address"]],
  ["get_program_analytics", "0.01", "Program analytics", { token_address: { type: "string" } }, ["token_address"]],
  ["list_marketplace_offers", "0.01", "List P2P offers", { token_address: { type: "string" } }, ["token_address"]],
  ["redeem_reward", "0.01", "Redeem reward for voucher", { reward_id: { type: "string" }, customer_address: { type: "string" }, transaction_hash: { type: "string" } }, ["reward_id", "customer_address", "transaction_hash"]],
  ["use_voucher", "0.01", "Mark voucher used", { voucher_code: { type: "string" }, voucher_id: { type: "string" } }],
  ["check_voucher_status", "0.01", "Check voucher by code or id", { voucher_code: { type: "string" }, voucher_id: { type: "string" } }],
  ["get_platform_stats", "0.01", "Admin: global platform statistics", {}],
  ["cancel_stale_offers", "0.01", "Cancel stale marketplace offers", { max_age_days: { type: "number" } }],
  ["create_personalized_offer", "0.01", "Create retention offer for a customer", { token_address: { type: "string" }, customer_address: { type: "string" } }, ["token_address", "customer_address"]],
  ["update_reward_status", "0.01", "Activate/deactivate reward", { reward_id: { type: "string" }, is_active: { type: "boolean" } }, ["reward_id"]],
  ["send_report", "0.01", "Submit agent report to merchant dashboard", { agent_role: { type: "string" }, report_type: { type: "string" }, title: { type: "string" }, content: { type: "string" }, priority: { type: "string" }, action_items: { type: "array", items: { type: "string" } } }, ["agent_role", "report_type", "title", "content"]],
  ["list_my_reports", "0.01", "List agent reports", {}],
  ["update_report_status", "0.01", "Update report status", { report_id: { type: "string" }, status: { type: "string" } }, ["report_id", "status"]],
  ["delete_report", "0.01", "Delete a report", { report_id: { type: "string" } }, ["report_id"]],
  ["export_customers", "0.01", "Export customers for a program", { token_address: { type: "string" } }, ["token_address"]],
  ["create_gift_certificate", "0.01", "Create gift / welcome certificate (LOYAL-XXXXXX); single or batch up to 100", { token_address: { type: "string" }, usd_amount: { type: "number" }, points_per_dollar: { type: "number" }, max_redemption_percent: { type: "number" }, title: { type: "string" }, description: { type: "string" }, expires_in_days: { type: "number" }, image_url: { type: "string" }, quantity: { type: "number" } }, ["token_address", "usd_amount"]],
  ["list_gift_certificates", "0.01", "List gift certificates issued by your merchant", { token_address: { type: "string" }, status: { type: "string" }, limit: { type: "number" } }],
  ["revoke_gift_certificate", "0.01", "Revoke an active gift certificate (active → revoked)", { certificate_id: { type: "string" } }, ["certificate_id"]],
  ["mark_gift_certificate_minted", "0.01", "Mark claimed certificate as minted with on-chain mint tx hash (pending_mint → redeemed)", { certificate_id: { type: "string" }, transaction_hash: { type: "string" } }, ["certificate_id", "transaction_hash"]],
  ["generate_program_defaults", "0.001", "Propose program name/symbol/economics/starter rewards from business context", { business_name: { type: "string" }, category: { type: "string" }, description: { type: "string" }, locale: { type: "string" }, preferred_style: { type: "string" }, target_audience: { type: "string" } }],
  ["get_program_workflow_status", "0.001", "Program lifecycle step + next_actions[] for autonomous orchestration", { token_address: { type: "string" } }],
];

// Recipient MCP tools — keep in sync with recipient-mcp-bazaar-tools.ts
const RECIPIENT_MCP_TOOLS = [
  ["get_recipient_profile", "0.01", "Recipient agent profile (rwk_ bound wallet)", {}],
  ["list_my_loyalty_balances", "0.01", "All loyalty tier balances for your wallet", {}],
  ["get_my_loyalty_balance", "0.01", "Balance and tier for one loyalty token", { token_address: { type: "string" } }, ["token_address"]],
  ["prepare_loyalty_token_transfer", "0.005", "ERC-20 transfer calldata for the holder", { token_address: { type: "string" }, to: { type: "string" }, amount: { type: "number" } }, ["token_address", "to", "amount"]],
  ["list_rewards_for_program", "0.01", "Redeemable rewards for a program you have activity on", { token_address: { type: "string" } }, ["token_address"]],
  ["list_my_vouchers", "0.01", "Vouchers for your wallet", {}],
  ["redeem_my_reward", "0.01", "Redeem reward with transfer tx hash", { reward_id: { type: "string" }, transaction_hash: { type: "string" } }, ["reward_id", "transaction_hash"]],
  ["list_p2p_offers", "0.001", "List P2P offers", { token_address: { type: "string" } }],
  ["create_p2p_offer", "0.01", "Create P2P swap intent", { offer_token_address: { type: "string" }, offer_amount: { type: "number" }, request_token_address: { type: "string" }, request_amount: { type: "number" } }, ["offer_token_address", "offer_amount", "request_token_address", "request_amount"]],
  ["accept_p2p_offer", "0.01", "Accept a P2P offer", { offer_id: { type: "string" } }, ["offer_id"]],
  ["cancel_p2p_offer", "0.005", "Cancel your P2P offer", { offer_id: { type: "string" } }, ["offer_id"]],
  ["lookup_gift_certificate", "0.01", "Preview a gift certificate by code (LOYAL-XXXXXX) without claiming", { code: { type: "string" } }, ["code"]],
  ["claim_gift_certificate", "0.01", "Claim an active gift certificate by code (binds it to your wallet)", { code: { type: "string" } }, ["code"]],
  ["list_my_gift_certificates", "0.01", "List gift certificates claimed by your wallet", { status: { type: "string" }, limit: { type: "number" } }],
  ["get_reward_workflow_status", "0.001", "Reward redemption step + next_actions[] for the holder", { token_address: { type: "string" }, reward_id: { type: "string" } }, ["token_address"]],
  ["prepare_reward_redemption", "0.005", "Prepare transfer calldata + redemption workflow for a reward", { reward_id: { type: "string" } }, ["reward_id"]],
];

// ---- Builders ----

function paymentInfo(price) {
  // structured per x402scan spec
  return {
    price: { mode: "fixed", currency: "USD", amount: String(price) },
    protocols: [
      { x402: {} },
      { mpp: { method: "USDC", intent: "pay-per-call", currency: "USD" } },
    ],
  };
}

function jsonOk() {
  return { description: "Successful response", content: { "application/json": { schema: { type: "object" } } } };
}

function paid402() {
  return { description: "Payment Required — returns x402 challenge with `accepts[]`" };
}

function isPaidRoute(meta) {
  return meta?.price && meta.price !== "0";
}

function buildRestOp(method, path, meta, kind) {
  const flexibleInputSchema = {
    type: "object",
    additionalProperties: true,
    description: method === "GET"
      ? "Query parameters for this request."
      : "JSON body for this request.",
  };

  const op = {
    operationId: `${method.toLowerCase()}_${path.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "")}`,
    summary: meta.summary,
    description: meta.desc,
    tags: [kind === "merchant" ? "Merchant REST" : "Recipient REST"],
    responses: { "200": jsonOk(), "402": paid402() },
    "x-input-schema": meta.body ?? flexibleInputSchema,
  };
  if (meta.price && meta.price !== "0") {
    op["x-payment-info"] = paymentInfo(meta.price);
  }
  if (kind === "recipient") {
    op["x-auth"] = { type: "apiKey", header: "x-api-key", prefix: "rwk_" };
  } else if (meta.auth === "none") {
    op.security = [];
  } else {
    op["x-auth"] = { type: "apiKey", header: "x-api-key", prefix: "lsk_" };
  }
  if (method === "POST" || method === "PUT" || method === "PATCH") {
    op.requestBody = {
      required: Boolean(meta.body),
      content: { "application/json": { schema: meta.body ?? flexibleInputSchema } },
    };
  } else {
    op.parameters = [
      {
        name: "query",
        in: "query",
        required: false,
        style: "deepObject",
        explode: true,
        description: "Query parameters passed through to the paid GET endpoint.",
        schema: flexibleInputSchema,
      },
    ];
  }
  return op;
}

function buildMcpOp(toolName, price, description, props, required, kind) {
  const inputSchema = {
    type: "object",
    properties: props,
    ...(required && required.length ? { required } : {}),
  };
  return {
    operationId: `mcp_${kind === "merchant" ? "" : "recipient_"}${toolName}`,
    summary: `MCP tool: ${toolName}`,
    description: `${description}. JSON-RPC 2.0 over Streamable HTTP. Body: { "jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": { "name": "${toolName}", "arguments": { ... } } }. Auth: x-api-key (${kind === "merchant" ? "lsk_" : "rwk_"}...) or Authorization: Bearer.`,
    tags: [kind === "merchant" ? "Merchant MCP" : "Recipient MCP"],
    "x-auth": { type: "apiKey", header: "x-api-key", prefix: kind === "merchant" ? "lsk_" : "rwk_" },
    "x-mcp": {
      tool: toolName,
      transport: "streamable-http",
      server: kind === "merchant" ? MCP_URL : RECIPIENT_MCP_URL,
      inputSchema,
    },
    "x-payment-info": paymentInfo(price),
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              jsonrpc: { type: "string", const: "2.0" },
              id: {},
              method: { type: "string", const: "tools/call" },
              params: {
                type: "object",
                properties: {
                  name: { type: "string", const: toolName },
                  arguments: inputSchema,
                },
                required: ["name"],
              },
            },
            required: ["jsonrpc", "method", "params"],
          },
        },
      },
    },
    responses: {
      "200": {
        description: "MCP JSON-RPC response with result.content[]",
        content: { "application/json": { schema: { type: "object" } } },
      },
      "402": paid402(),
    },
  };
}

// ---- Compose ----

const paths = {};

// Merchant REST — only paid x402 routes
for (const [method, routes] of Object.entries(MERCHANT_REST)) {
  for (const [p, meta] of Object.entries(routes)) {
    if (!isPaidRoute(meta)) continue;
    const gp = `${PUBLIC_GATEWAY_PATH}${p}`;
    paths[gp] = paths[gp] || {};
    paths[gp][method.toLowerCase()] = buildRestOp(method, p, meta, "merchant");
  }
}

// Recipient REST — only paid x402 routes
for (const [method, routes] of Object.entries(RECIPIENT_REST)) {
  for (const [p, meta] of Object.entries(routes)) {
    if (!isPaidRoute(meta)) continue;
    const gp = `${PUBLIC_GATEWAY_PATH}${p}`;
    paths[gp] = paths[gp] || {};
    paths[gp][method.toLowerCase()] = buildRestOp(method, p, meta, "recipient");
  }
}

// Merchant MCP — paths under /x402-gateway/mcp-tools/<name>
for (const [name, price, desc, props, required] of MCP_TOOLS) {
  const p = `${PUBLIC_GATEWAY_PATH}/mcp-tools/${name}`;
  paths[p] = { post: buildMcpOp(name, price, desc, props || {}, required, "merchant") };
}

// Recipient MCP — paths under /x402-gateway/recipient-mcp-tools/<name>
for (const [name, price, desc, props, required] of RECIPIENT_MCP_TOOLS) {
  const p = `${PUBLIC_GATEWAY_PATH}/recipient-mcp-tools/${name}`;
  paths[p] = { post: buildMcpOp(name, price, desc, props || {}, required, "recipient") };
}

const totalPaths = Object.keys(paths).length;
const totalOps = Object.values(paths).reduce((n, methods) => n + Object.keys(methods).length, 0);

const openapi = {
  openapi: "3.1.0",
  info: {
    title: "Loyal Spark — Onchain Loyalty Protocol on Base",
    version: "2.2.0",
    summary: "AI-agent-native loyalty-as-a-service protocol on Base L2 with paid x402 + MPP corridors.",
    description:
      "Loyal Spark is an onchain loyalty-as-a-service protocol on Base L2. AI agents and merchants can create ERC-20 loyalty programs, mint tokens to customer wallets, manage reward catalogs, trade tokens on a P2P escrow marketplace, redeem rewards for vouchers, and run analytics — all via paid x402 endpoints (USDC on Base) or via standard REST with x-api-key. " +
      `Coverage: ${totalOps} paid operations across ${totalPaths} paths (x402 corridor). Direct MCP (x-api-key) exposes 39 merchant + 20 recipient tools; paid x402 MCP prices ${MCP_TOOLS.length} merchant + ${RECIPIENT_MCP_TOOLS.length} recipient tools (confirm_mint_fee is lsk_-only settlement, not x402-priced). Builder Code bc_wdmnog7m.`,
    "x-guidance":
      `Loyal Spark on Base L2 (chain 8453, USDC native).\n\nAuth modes:\n• Merchant agents — header x-api-key: lsk_... (or Authorization: Bearer lsk_...). Get a key in https://loyalspark.online/merchant → AI Agents.\n• Holder agents — header x-api-key: rwk_... (or Authorization: Bearer rwk_...). Issued via SIWE: https://loyalspark.online/.well-known/agent.json.\n• x402 corridor — pay USDC on Base per call. Discovery: https://api.loyalspark.online/.well-known/x402 (static mirror: https://loyalspark.online/.well-known/x402.json).\n\nTypical merchant flow (B20 default):\n1. GET /me — profile and scopes\n2. POST /programs — B20 createB20 calldata\n3. POST /register-program — persist program (status active)\n4. POST /update-program-config — set cashback_rate / points_per_dollar\n5. POST /rewards — catalog\n6. POST /mint or POST /earn — fee-first calls[] + fee_obligation_id\n7. POST /mint/confirm — settle protocol fee on-chain\n8. GET /analytics — metrics\n\nLegacy ERC-20: add POST /activate-program + program-status after register.\n\nDirect MCP: 39 merchant tools at ${MCP_URL} and 20 recipient tools at ${RECIPIENT_MCP_URL}. Paid x402 MCP paths: /x402-gateway/mcp-tools/<name> (${MCP_TOOLS.length}) and /x402-gateway/recipient-mcp-tools/<name> (${RECIPIENT_MCP_TOOLS.length}).\n\nDocs: https://loyalspark.online/api-docs · llms: https://loyalspark.online/llms.txt · agent manifest: https://loyalspark.online/.well-known/agent.json`,
    contact: {
      name: "Loyal Spark",
      email: "admin@loyalspark.online",
      url: "https://loyalspark.online",
    },
    license: { name: "MIT", url: "https://github.com/loyalspark" },
    "x-logo": { url: "https://loyalspark.online/new-favicon.png", altText: "Loyal Spark" },
    "x-provider": "Loyal Spark",
    "x-brand": "Loyal Spark",
    "x-builder-code": "bc_wdmnog7m",
    "x-mcp": { url: MCP_URL, transport: "streamable-http", tool_count: 39 },
    "x-recipient-mcp": { url: RECIPIENT_MCP_URL, transport: "streamable-http", tool_count: 20 },
    "x-x402-discovery": {
      wellKnownResources: `${API_ORIGIN}/.well-known/x402`,
      gatewayBaseUrl: GATEWAY,
      asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      network: "eip155:8453",
    },
  },
  servers: [
    { url: API_ORIGIN, description: "Loyal Spark — canonical API origin for x402scan discovery and paid resource invocation. All listed x402 gateway paths return live HTTP 402 payment requirements." },
  ],
  security: [{ apiKey: [] }],
  components: {
    securitySchemes: {
      apiKey: { type: "apiKey", in: "header", name: "x-api-key", description: "Agent API key (lsk_... merchant or rwk_... recipient)" },
      siwx: { type: "apiKey", in: "header", name: "SIGN-IN-WITH-X", description: "SIWE proof (identity-only routes)" },
    },
  },
  tags: [
    { name: "Merchant REST", description: "Authenticated merchant REST API (lsk_)" },
    { name: "Recipient REST", description: "Holder REST API (rwk_)" },
    { name: "Merchant MCP", description: `${MCP_TOOLS.length} paid merchant MCP tools via x402 (direct loyalty-mcp exposes 39 with x-api-key)` },
    { name: "Recipient MCP", description: `${RECIPIENT_MCP_TOOLS.length} paid recipient MCP tools via x402 (direct recipient-loyalty-mcp exposes 20 with x-api-key)` },
  ],
  paths,
};

writeFileSync(resolve(ROOT, "public/openapi.json"), JSON.stringify(openapi, null, 2) + "\n");

// /.well-known/x402 — METHOD /full-url entries per spec sample
const wellKnownResources = [];
for (const [method, routes] of Object.entries(MERCHANT_REST)) {
  for (const [p, meta] of Object.entries(routes)) {
    if (!isPaidRoute(meta)) continue;
    wellKnownResources.push(`${method} ${GATEWAY}${p.startsWith("/") ? p : `/${p}`}`);
  }
}
for (const [method, routes] of Object.entries(RECIPIENT_REST)) {
  for (const [p, meta] of Object.entries(routes)) {
    if (!isPaidRoute(meta)) continue;
    wellKnownResources.push(`${method} ${GATEWAY}${p}`);
  }
}
for (const [name] of MCP_TOOLS) {
  wellKnownResources.push(`POST ${GATEWAY}/mcp-tools/${name}`);
}
for (const [name] of RECIPIENT_MCP_TOOLS) {
  wellKnownResources.push(`POST ${GATEWAY}/recipient-mcp-tools/${name}`);
}

const wellKnown = {
  version: 1,
  name: "Loyal Spark — Onchain Loyalty Protocol on Base",
  description:
    `Loyal Spark is an onchain loyalty-as-a-service protocol on Base L2. AI agents and merchants can create B20 loyalty programs, mint tokens to customer wallets, manage rewards catalogs, trade tokens on a P2P escrow marketplace, redeem rewards for vouchers, and run analytics — all via paid x402 endpoints (USDC on Base). Includes ${wellKnownResources.length} paid x402 resources: merchant REST (agent-api), recipient REST (recipient-api), ${MCP_TOOLS.length} merchant MCP tools and ${RECIPIENT_MCP_TOOLS.length} recipient MCP tools via paid x402 corridor (direct MCP exposes 39 merchant + 20 recipient tools with x-api-key; confirm_mint_fee is lsk_-only settlement, not x402-priced). Builder Code bc_wdmnog7m.`,
  provider: "Loyal Spark",
  website: "https://loyalspark.online",
  documentation: "https://loyalspark.online/for-agents",
  openapi: "https://loyalspark.online/openapi.json",
  network: "eip155:8453",
  asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  builderCode: "bc_wdmnog7m",
  resources: wellKnownResources.sort(),
};
writeFileSync(resolve(ROOT, "public/.well-known/x402"), JSON.stringify(wellKnown, null, 2) + "\n");
writeFileSync(resolve(ROOT, "public/.well-known/x402.json"), JSON.stringify(wellKnown, null, 2) + "\n");

console.log(`✓ openapi.json: ${totalOps} operations / ${totalPaths} paths`);
console.log(`✓ .well-known/x402: ${wellKnownResources.length} resources`);
