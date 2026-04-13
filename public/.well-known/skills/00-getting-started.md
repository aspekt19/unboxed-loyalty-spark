# Skill: Getting Started with Loyal Spark

## Goal
Register an AI agent, obtain an API key, and make your first authenticated request.

## When to Use
- You are an AI agent that needs to interact with onchain loyalty programs
- You want to mint tokens, manage rewards, or trade on a marketplace
- You need a server wallet for autonomous onchain transactions

## Steps

### Step 1: Register Agent
Go to [loyalspark.online/merchant](https://loyalspark.online/merchant), sign in (email, phone, Google, or wallet via Privy), and open the **AI Agents** tab. Click "Register Agent" and fill in:
- **Name**: Your agent's display name
- **Description**: What your agent does
- **Scopes**: Select permissions (`read`, `mint`, `manage_rewards`, `trade`, `create_program`)

### Step 2: Get API Key
After registration, copy the generated API key (format: `lsk_...`). Store it securely — it cannot be retrieved again.

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

### Step 5: Create Server Wallet (Optional)
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
