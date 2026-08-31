# Skill: Getting Started with Loyal Spark

## Goal
Register an AI agent, obtain an API key, and make your first authenticated request.

## When to Use
- You are an AI agent that needs to interact with onchain loyalty programs
- You want to mint tokens, manage rewards, or trade on a marketplace
- You need a server wallet for autonomous onchain transactions

## Steps

### Step 1: Register Agent

Pick **one** path:

- **Merchant dashboard:** open [loyalspark.online/merchant](https://loyalspark.online/merchant) → **Sign In** until **Profile** appears → **AI Agents** → **Register Agent**. Fill in **Name**, **Description**, and **Scopes** (`read`, `mint`, `manage_rewards`, `trade`, `create_program`).

- **Fully autonomous (no dashboard):** free `lsk_` via SIWE (`siwe-nonce` → sign EIP-4361 → `agent-register-siwe`). Details: **[AUTONOMOUS_AGENT_REGISTRATION.md](https://github.com/aspekt19/unboxed-loyalty-spark/blob/a2a-agents/docs/agents/AUTONOMOUS_AGENT_REGISTRATION.md)**. Optional developer helper (not part of the web app): `scripts/agent-register-siwe/` in the repo README.

### Step 2: Get API Key
Copy the generated API key (format: `lsk_...`). Store it securely — it cannot be retrieved again.

### Step 3: Authenticate
Include the API key in every request:

**REST API:**
```bash
curl -X GET \
  "https://api.loyalspark.online/agent-api/me" \
  -H "x-api-key: lsk_your_key_here"
```

**MCP Server:**
```json
{
  "mcpServers": {
    "loyal-spark": {
      "url": "https://api.loyalspark.online/loyalty-mcp",
      "transport": "streamable-http",
      "headers": {
        "x-api-key": "lsk_your_key_here"
      }
    }
  }
}
```

### Step 4: Verify Connection
Call `GET /me` (REST) or `get_my_profile` (MCP) to confirm authentication:

```bash
curl -H "x-api-key: lsk_..." \
  "https://api.loyalspark.online/agent-api/me"
```

**Expected response:**
```json
{
  "agent": {
    "id": "uuid",
    "name": "My Agent",
    "scopes": ["read", "mint"],
    "owner_address": "0x..."
  }
}
```

### Step 4.5: Learn the Workflow Before Calling Write Endpoints

Before using lifecycle, rewards, mint, vouchers, or marketplace endpoints, read the workflow guide:

- [Endpoint Workflows](./13-endpoint-workflows.md)

Important orchestration rules:

- `POST /programs` or `create_loyalty_program` starts a deploy flow; it does **not** finish it
- new B20 programs become usable only after deploy + register
- legacy ERC-20 programs need deploy + register + activate + status update
- rewards usually come after the program exists
- minting comes only after the program is active
- voucher redemption comes only after confirmed onchain token transfer

### Step 5 (Optional): Pay-per-call MCP via x402 (Bazaar-compatible)

If the agent should **pay USDC per MCP call** instead of using subscription-only access to `loyalty-mcp` or `recipient-loyalty-mcp`:

- **Merchant tools:** **`POST`** `…/x402-gateway/mcp-tools/<tool_name>` — header **`x-api-key: lsk_...`** on the paid retry. Schemas: **`mcp-bazaar-tools.ts`**.
- **Recipient / holder tools:** **`POST`** `…/x402-gateway/recipient-mcp-tools/<tool_name>` — **`x-api-key: rwk_...`**. Schemas: **`recipient-mcp-bazaar-tools.ts`**.
- JSON-RPC **`tools/call`** with same **`name`** / **`arguments`** as direct MCP.
- Use an x402 client (**`@x402/fetch`**, **`@x402/evm`**) and a wallet with **USDC on Base** to satisfy **HTTP 402**. The gateway adds **Bazaar**-oriented fields on **402** via **`x402-bazaar-accept.ts`** (MCP routes use `outputSchema.input.type: "mcp"` for both URL families).

### Step 6: Create Server Wallet (Optional)
For autonomous onchain transactions, create a Coinbase MPC wallet:

```bash
curl -X POST \
  "https://api.loyalspark.online/agent-api" \
  -H "x-api-key: lsk_..." \
  -H "Content-Type: application/json" \
  -d '{"action": "create_wallet"}'
```

## Success Criteria
- ✅ API key obtained and stored securely
- ✅ `GET /me` returns agent profile
- ✅ Scopes match intended operations

## Next Skills
- [Create Loyalty Program](./01-create-loyalty-program.md)
- [Mint Tokens](./02-mint-tokens.md)
