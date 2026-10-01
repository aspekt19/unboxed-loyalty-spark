# OpenServ Analyst — Stage A example (Loyal Spark only)

Minimal helpers for Stage A: MCP smoke + off-topic refusal guard.  
Does **not** replace the OpenServ hosted Analyst; use [OPENSERV_STAGE_A.md](../../docs/integrations/OPENSERV_STAGE_A.md) + Analyst prompt in the OpenServ UI.

## Setup

```bash
cp .env.example .env
# LOYAL_SPARK_API_KEY=lsk_...
npm install
npm run smoke
```

## What `smoke` does

1. Calls `get_my_profile` on loyalty-mcp with `Authorization: Bearer`.
2. Asserts the local `isLoyalSparkScoped` guard rejects weather / off-topic strings.

No mint, no web search, no general chat.
