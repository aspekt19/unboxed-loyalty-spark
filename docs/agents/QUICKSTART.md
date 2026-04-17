# AI agents — quickstart (repo)

Live onboarding page: **[https://loyalspark.online/for-agents](https://loyalspark.online/for-agents)**

## 1. API key

### A) Dashboard (humans + logged-in merchants)

1. Open [loyalspark.online/merchant](https://loyalspark.online/merchant)  
2. Sign in (Privy: email / phone / social / wallet). The **Profile** button appears only **after** a Supabase session exists — use **Sign In** in the header first.  
3. **AI Agents** → register → copy `lsk_...` (shown once)

### B) Autonomous agents (no browser login)

Free **`lsk_`** via **SIWE** (wallet signs a message; same 10 agents/wallet limit as the dashboard):  
**[AUTONOMOUS_AGENT_REGISTRATION.md](./AUTONOMOUS_AGENT_REGISTRATION.md)** — `siwe-nonce` → sign EIP-4361 message → `POST …/agent-register-siwe`.

Portal behaviour (header order, team invites, migrations): [PORTALS_AND_TEAM.md](../development/PORTALS_AND_TEAM.md).

## 2. REST (smoke test)

```bash
export LOYAL_SPARK_API_KEY='lsk_...'
curl -sS -H "x-api-key: $LOYAL_SPARK_API_KEY" \
  "https://bzxmejzssxjazswgwqqs.supabase.co/functions/v1/agent-api/programs"
```

Public (no key): `GET .../agent-api/vouchers/status?code=LOYAL-...`

## 3. MCP (Cursor)

Copy [examples/agent-mcp/cursor-mcp.json](../../examples/agent-mcp/cursor-mcp.json) into `.cursor/mcp.json` (merge `mcpServers`) and replace the placeholder key.

## 4. MCP via x402 (pay-per-call, Bazaar-compatible)

Use the **same** tools as `loyalty-mcp`, but URL pattern:

`POST https://bzxmejzssxjazswgwqqs.supabase.co/functions/v1/x402-gateway/mcp-tools/<tool_name>`

Body: JSON-RPC `tools/call` with `name` and `arguments`. Headers: `x-api-key: lsk_...` (after payment).  
Client: `@x402/fetch` + `@x402/evm` (wallet with USDC on Base pays the 402).  
Reference: [X402_MCP_AND_BAZAAR.md](./X402_MCP_AND_BAZAAR.md) · local script: `scripts/x402-paid-mcp-test/run.mjs`.

## 5. Discovery (for crawlers & tools)

| Resource | URL |
|----------|-----|
| Agent manifest | https://loyalspark.online/.well-known/agent.json |
| OpenAPI | https://loyalspark.online/openapi.json |
| Skills | https://loyalspark.online/.well-known/skills/index.md |
| Short LLM summary | https://loyalspark.online/llms.txt |

## 6. Repo map

- [AGENTS.md](../../AGENTS.md) — index for coding agents  
- [../README.md](../README.md) — docs layout  
- MCP tool ids: `src/constants/mcpToolNames.ts` (must match `loyalty-mcp/index.ts`)
- x402 MCP tool **schemas** (Bazaar / pricing): `supabase/functions/_shared/mcp-bazaar-tools.ts`

## 7. Recipient agents (`rwk_`) — optional

For agents that **only** control a wallet which receives loyalty points (not a merchant). Register with SIWE + `POST …/recipient-api/register`; see **[https://loyalspark.online/for-agents](https://loyalspark.online/for-agents)** (Recipient section) and `src/constants/recipientMcpToolNames.ts` / `recipient-loyalty-mcp/index.ts`.
