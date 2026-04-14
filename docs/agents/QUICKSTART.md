# AI agents — quickstart (repo)

Live onboarding page: **[https://loyalspark.online/for-agents](https://loyalspark.online/for-agents)**

## 1. API key

1. Open [loyalspark.online/merchant](https://loyalspark.online/merchant)  
2. Sign in (Privy: email / phone / social / wallet)  
3. **AI Agents** → register → copy `lsk_...` (shown once)

## 2. REST (smoke test)

```bash
export LOYAL_SPARK_API_KEY='lsk_...'
curl -sS -H "x-api-key: $LOYAL_SPARK_API_KEY" \
  "https://bzxmejzssxjazswgwqqs.supabase.co/functions/v1/agent-api/programs"
```

Public (no key): `GET .../agent-api/vouchers/status?code=LOYAL-...`

## 3. MCP (Cursor)

Copy [examples/agent-mcp/cursor-mcp.json](../../examples/agent-mcp/cursor-mcp.json) into `.cursor/mcp.json` (merge `mcpServers`) and replace the placeholder key.

## 4. Discovery (for crawlers & tools)

| Resource | URL |
|----------|-----|
| Agent manifest | https://loyalspark.online/.well-known/agent.json |
| OpenAPI | https://loyalspark.online/openapi.json |
| Skills | https://loyalspark.online/.well-known/skills/index.md |
| Short LLM summary | https://loyalspark.online/llms.txt |

## 5. Repo map

- [AGENTS.md](../../AGENTS.md) — index for coding agents  
- [../README.md](../README.md) — docs layout  
- MCP tool ids: `src/constants/mcpToolNames.ts` (must match `loyalty-mcp/index.ts`)
