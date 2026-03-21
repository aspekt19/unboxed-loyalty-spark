# Agent-to-Agent (A2A) Loyalty Protocol — Integration Plan

## Concept: Dual-Mode Platform (Humans + AI Agents)

The application remains a single platform where **humans** interact via UI (SIWE + wallet),
and **AI agents** interact via API/MCP. Shared database, shared smart contracts, shared tokens.

```
┌─────────────────────────────────────────────────┐
│              Loyal Spark Platform                │
│                                                  │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐   │
│  │  Web UI   │    │ REST API │    │MCP Server│   │
│  │ (humans)  │    │ (agents) │    │ (agents) │   │
│  └─────┬─────┘    └─────┬────┘    └─────┬────┘   │
│        │                │               │        │
│        ▼                ▼               ▼        │
│  ┌──────────────────────────────────────────┐    │
│  │         Supabase (Edge Functions)         │    │
│  │    Auth · RLS · DB · Realtime             │    │
│  └─────────────────┬────────────────────────┘    │
│                    │                             │
│        ┌───────────┴───────────┐                 │
│        ▼                       ▼                 │
│  ┌──────────┐          ┌──────────────┐          │
│  │ Base L2  │          │ CDP Server   │          │
│  │ Contracts│          │ Wallet (MPC) │          │
│  └──────────┘          └──────────────┘          │
└─────────────────────────────────────────────────┘
```

---

## Phase 1: Agent Registry & API Keys (DB + Edge Function)

### 1.1 New Tables

```sql
-- AI Agent Registry
CREATE TABLE public.agent_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,                        -- "CoffeeBot Agent"
  owner_address text NOT NULL,               -- wallet of the owner (merchant or user)
  agent_wallet_address text,                 -- CDP Server Wallet address for the agent
  api_key_hash text NOT NULL,                -- bcrypt hash of the API key
  api_key_prefix text NOT NULL,              -- first 8 chars (for identification)
  scopes text[] DEFAULT '{read}',            -- permissions: read, create_program, mint, trade, manage_rewards
  is_active boolean DEFAULT true,
  rate_limit_per_minute int DEFAULT 60,
  total_requests bigint DEFAULT 0,
  last_request_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Agent Activity Log (audit trail)
CREATE TABLE public.agent_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid REFERENCES agent_registry(id) ON DELETE CASCADE,
  action text NOT NULL,                      -- "create_program", "mint_tokens", "list_rewards"
  request_body jsonb,
  response_status int,
  ip_address text,
  created_at timestamptz DEFAULT now()
);

-- RLS: owners can see their own agents
ALTER TABLE agent_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage own agents" ON agent_registry
  FOR ALL TO authenticated
  USING (owner_address = (SELECT wallet_address FROM profiles WHERE user_id = auth.uid()))
  WITH CHECK (owner_address = (SELECT wallet_address FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Owners can view agent activity" ON agent_activity_log
  FOR SELECT TO authenticated
  USING (agent_id IN (
    SELECT id FROM agent_registry
    WHERE owner_address = (SELECT wallet_address FROM profiles WHERE user_id = auth.uid())
  ));
```

### 1.2 Edge Function: API Key Generation

```
POST /functions/v1/agent-api-key
Headers: Authorization: Bearer <user_jwt>
Body: { "name": "My Agent", "scopes": ["read", "mint"] }
Response: { "api_key": "lsk_abc123...", "agent_id": "uuid" }
```

- Generates a random key with `lsk_` prefix
- Stores bcrypt hash in `agent_registry`
- Key is shown once, then only `api_key_prefix` is visible

### 1.3 Agent Authentication Middleware

```typescript
// In every agent-facing Edge Function:
async function authenticateAgent(req: Request): Promise<AgentContext> {
  const apiKey = req.headers.get('x-api-key');
  if (!apiKey || !apiKey.startsWith('lsk_')) throw new Error('Invalid API key');

  const prefix = apiKey.substring(0, 12);
  const { data: agent } = await supabase
    .from('agent_registry')
    .select('*')
    .eq('api_key_prefix', prefix)
    .eq('is_active', true)
    .single();

  if (!agent) throw new Error('Agent not found');

  // Verify bcrypt hash
  const valid = await bcrypt.compare(apiKey, agent.api_key_hash);
  if (!valid) throw new Error('Invalid API key');

  // Rate limiting check
  if (agent.last_request_at) {
    // ... rate limit verification
  }

  return { agentId: agent.id, scopes: agent.scopes, walletAddress: agent.agent_wallet_address };
}
```

---

## Phase 2: REST API for Agents (Edge Functions)

### 2.1 Endpoints

| Method | Path | Scope | Description |
|--------|------|-------|-------------|
| GET | `/agent-api/programs` | `read` | List all active loyalty programs |
| GET | `/agent-api/programs/:address` | `read` | Program details by token_address |
| POST | `/agent-api/programs` | `create_program` | Create program + deploy contract |
| GET | `/agent-api/rewards` | `read` | List rewards for a program |
| POST | `/agent-api/rewards` | `manage_rewards` | Create a reward |
| POST | `/agent-api/mint` | `mint` | Mint tokens to a customer/agent |
| GET | `/agent-api/balance` | `read` | Token balance |
| POST | `/agent-api/marketplace/offer` | `trade` | Create a marketplace offer |
| GET | `/agent-api/marketplace` | `read` | List active offers |

### 2.2 Single Edge Function with Routing

```typescript
// supabase/functions/agent-api/index.ts
Deno.serve(async (req) => {
  // CORS
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  const path = url.pathname.replace('/agent-api', '');
  const agent = await authenticateAgent(req);

  // Routing
  switch (true) {
    case path === '/programs' && req.method === 'GET':
      return handleListPrograms(agent);
    case path === '/programs' && req.method === 'POST':
      requireScope(agent, 'create_program');
      return handleCreateProgram(agent, await req.json());
    case path === '/mint' && req.method === 'POST':
      requireScope(agent, 'mint');
      return handleMint(agent, await req.json());
    // ...
  }
});
```

### 2.3 Example Agent Call

```typescript
// Agent creates a loyalty program
const response = await fetch('https://<project>.supabase.co/functions/v1/agent-api/programs', {
  method: 'POST',
  headers: {
    'x-api-key': 'lsk_abc123...',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    name: 'AI Coffee Rewards',
    symbol: 'AICOF',
    expiration_days: 365,
  }),
});
```

---

## Phase 3: MCP Server (for LLM Agents)

### 3.1 MCP Server as Edge Function

Using the `mcp-lite` library to create an MCP server:

```typescript
// supabase/functions/loyalty-mcp/index.ts
import { Hono } from "hono";
import { McpServer, StreamableHttpTransport } from "mcp-lite";

const mcpServer = new McpServer({
  name: "loyal-spark-mcp",
  version: "1.0.0",
});

// Tool: List loyalty programs
mcpServer.tool({
  name: "list_loyalty_programs",
  description: "List all active loyalty programs on the platform",
  inputSchema: {
    type: "object",
    properties: {
      status: { type: "string", enum: ["active", "all"], default: "active" },
    },
  },
  handler: async ({ status }) => {
    const { data } = await supabase
      .from('loyalty_programs')
      .select('*')
      .eq('status', status === 'all' ? undefined : 'active');
    return { content: [{ type: "text", text: JSON.stringify(data) }] };
  },
});

// Tool: Create program
mcpServer.tool({
  name: "create_loyalty_program",
  description: "Deploy a new loyalty token program on Base L2",
  inputSchema: {
    type: "object",
    properties: {
      name: { type: "string", description: "Program name, e.g. 'Coffee Rewards'" },
      symbol: { type: "string", description: "Token symbol, e.g. 'COFFEE'" },
      expiration_days: { type: "number", description: "Days until program expires" },
    },
    required: ["name", "symbol", "expiration_days"],
  },
  handler: async ({ name, symbol, expiration_days }) => {
    // 1. Use CDP Server Wallet to deploy
    // 2. Save to loyalty_programs
    // 3. Return token_address
  },
});

// Tool: Mint tokens
mcpServer.tool({
  name: "mint_loyalty_tokens",
  description: "Mint loyalty tokens to a customer or agent wallet",
  inputSchema: {
    type: "object",
    properties: {
      token_address: { type: "string" },
      recipient: { type: "string", description: "Wallet address of recipient" },
      amount: { type: "number", description: "Number of tokens to mint" },
    },
    required: ["token_address", "recipient", "amount"],
  },
  handler: async ({ token_address, recipient, amount }) => {
    // CDP Server Wallet signs the mint transaction
  },
});

// Tool: List rewards
mcpServer.tool({
  name: "list_rewards",
  description: "List available rewards for a loyalty program",
  inputSchema: {
    type: "object",
    properties: {
      token_address: { type: "string" },
    },
    required: ["token_address"],
  },
  handler: async ({ token_address }) => {
    const { data } = await supabase
      .from('rewards')
      .select('*')
      .eq('token_address', token_address)
      .eq('is_active', true);
    return { content: [{ type: "text", text: JSON.stringify(data) }] };
  },
});

// Resource: platform information
mcpServer.resource({
  uri: "loyalty://platform-info",
  name: "Platform Information",
  description: "General information about Loyal Spark platform",
  handler: async () => ({
    contents: [{
      uri: "loyalty://platform-info",
      mimeType: "application/json",
      text: JSON.stringify({
        name: "Loyal Spark",
        chain: "Base L2",
        token_standard: "ERC-20",
        features: ["loyalty_programs", "rewards", "marketplace", "tiers", "referrals"],
      }),
    }],
  }),
});
```

### 3.2 Connecting an Agent to MCP

```json
// In the AI agent config (Claude, GPT, etc.)
{
  "mcpServers": {
    "loyal-spark": {
      "url": "https://<project>.supabase.co/functions/v1/loyalty-mcp",
      "headers": {
        "x-api-key": "lsk_abc123..."
      }
    }
  }
}
```

---

## Phase 4: CDP Server Wallet for Agents

### 4.1 Why CDP is Needed

When an agent creates a program or mints tokens, a transaction signature is required.
CDP Server Wallet solves this:
- Private key **never** leaves Coinbase's secure enclave
- Agent calls API → CDP signs → transaction is sent to Base

### 4.2 Integration

```typescript
// In Edge Function
import { CdpClient } from '@coinbase/cdp-sdk';

const cdp = new CdpClient({
  apiKeyId: Deno.env.get('CDP_API_KEY_ID'),
  apiKeySecret: Deno.env.get('CDP_API_KEY_SECRET'),
});

// Create a wallet for a new agent
async function createAgentWallet(agentId: string) {
  const account = await cdp.evm.createAccount({ name: `agent-${agentId}` });

  // Save address to agent_registry
  await supabase
    .from('agent_registry')
    .update({ agent_wallet_address: account.address })
    .eq('id', agentId);

  return account.address;
}

// Sign a mint transaction on behalf of an agent
async function agentMint(agentWallet: string, tokenAddress: string, to: string, amount: bigint) {
  const txHash = await cdp.evm.sendTransaction({
    address: agentWallet,
    transaction: {
      to: tokenAddress,
      data: encodeFunctionData({
        abi: loyaltyTokenAbi,
        functionName: 'mint',
        args: [to, amount],
      }),
    },
    network: 'base',
  });

  return txHash;
}
```

### 4.3 Required Secrets

| Secret | Source |
|--------|--------|
| `CDP_API_KEY_ID` | Coinbase Developer Platform → API Keys |
| `CDP_API_KEY_SECRET` | Coinbase Developer Platform → API Keys |

---

## Phase 5: UI for Agent Management (in the existing app)

### 5.1 New Tab in MerchantPage

```
Merchant Panel
├── Programs (existing)
├── Rewards (existing)
├── CRM (existing)
├── 🤖 AI Agents (NEW)
│   ├── Register an agent
│   ├── Manage API keys
│   ├── Configure scopes (permissions)
│   ├── Agent activity log
│   └── Rate limits
```

### 5.2 Components

- `src/components/agents/AgentRegistration.tsx` — agent registration form
- `src/components/agents/AgentApiKeys.tsx` — key management
- `src/components/agents/AgentActivityLog.tsx` — activity journal
- `src/components/agents/AgentScopeSelector.tsx` — permissions configuration

---

## Implementation Order

### Stage 1 (MVP — 1-2 days)
1. ✅ Create tables `agent_registry` + `agent_activity_log`
2. ✅ Edge Function for API key generation
3. ✅ Edge Function `agent-api` with basic GET endpoints (list programs, rewards)
4. ✅ UI: "AI Agents" tab in MerchantPage

### Stage 2 (Write via API — 1-2 days)
5. POST endpoints (create program, mint, create reward)
6. Integration with existing smart contracts via server-side signing
7. Audit log for all actions

### Stage 3 (MCP Server — 1 day)
8. MCP Server Edge Function with tools for all operations
9. Testing with MCP Inspector
10. Documentation for connecting agents

### Stage 4 (CDP Wallets — 1-2 days)
11. CDP SDK integration
12. Automatic wallet creation for agents
13. Server-side transaction signing (mint, transfer, deploy)

### Stage 5 (Advanced Features)
14. Agent-to-Agent token exchange via marketplace
15. Automation rules via API
16. Webhook notifications for agents
17. Discovery protocol (agent can find suitable programs)

---

## Compatibility: Humans + Agents

| Feature | Humans (UI) | Agents (API/MCP) |
|---------|-------------|------------------|
| Authentication | SIWE (wallet signature) | API key (`x-api-key`) |
| Wallet | MetaMask / WalletConnect | CDP Server Wallet (MPC) |
| Create program | UI form → tx via browser wallet | POST `/programs` → tx via CDP |
| Mint tokens | Form → browser wallet signs | POST `/mint` → CDP signs |
| View data | React components | GET endpoints / MCP resources |
| Marketplace | UI cards | POST `/marketplace/offer` |
| Data | Shared Supabase DB, same tables |
| Contracts | Same smart contracts on Base |
| Tokens | Same ERC-20 tokens |

**Key principle**: The API layer is a "wrapper" around the same operations the UI performs.
No business logic duplication — just a new transport layer.
