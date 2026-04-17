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

- **Fully autonomous (no dashboard):** free `lsk_` via SIWE (`siwe-nonce` → sign EIP-4361 → `agent-register-siwe`). Details: **[AUTONOMOUS_AGENT_REGISTRATION.md](https://github.com/aspekt19/unboxed-loyalty-spark/blob/main/docs/agents/AUTONOMOUS_AGENT_REGISTRATION.md)**. Optional developer helper (not part of the web app): `scripts/agent-register-siwe/` in the repo README.

### Step 2: Get API Key
Copy the generated API key (format: `lsk_...`). Store it securely — it cannot be retrieved again.

### Step 3: Authenticate
Include the API key in every request:

**REST API:**
```bash
curl -X GET \
  "https://bzxmejzssxjazswgwqqs.supabase.co/functions/v1/agent-api/me" \
  -H "x-api-key: lsk_your_key_here"
```

**MCP Server:**
```json
{
  "mcpServers": {
    "loyal-spark": {
      "url": "https://bzxmejzssxjazswgwqqs.supabase.co/functions/v1/loyalty-mcp",
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
  "https://bzxmejzssxjazswgwqqs.supabase.co/functions/v1/agent-api/me"
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

### Step 5 (Optional): Pay-per-call MCP via x402 (Bazaar-compatible)

If the agent should **pay USDC per MCP call** instead of using subscription-only access to `loyalty-mcp`:

- Use **`POST`** to  
  `https://bzxmejzssxjazswgwqqs.supabase.co/functions/v1/x402-gateway/mcp-tools/<tool_name>`  
  with JSON-RPC **`tools/call`**, same **`name`** / **`arguments`** as direct MCP, and header **`x-api-key: lsk_...`** on the **paid** retry.
- Use an x402 client (**`@x402/fetch`**, **`@x402/evm`**) and a wallet with **USDC on Base** to satisfy **HTTP 402**.
- **Parameter reference** (required fields, types): repository file **`supabase/functions/_shared/mcp-bazaar-tools.ts`** — keep prompts aligned with these schemas.

### Step 6: Create Server Wallet (Optional)
For autonomous onchain transactions, create a Coinbase MPC wallet:

```bash
curl -X POST \
  "https://bzxmejzssxjazswgwqqs.supabase.co/functions/v1/agent-api" \
  -H "x-api-key: lsk_..." \
  -H "Content-Type: application/json" \
  -d '{"action": "create_server_wallet"}'
```

## Success Criteria
- ✅ API key obtained and stored securely
- ✅ `GET /me` returns agent profile
- ✅ Scopes match intended operations

## Next Skills
- [Create Loyalty Program](./01-create-loyalty-program.md)
- [Mint Tokens](./02-mint-tokens.md)
