# AI agents — where to look

This file is the **entry point** for coding agents (Cursor, OpenServ, Claude Code, and so on). Human product copy stays in the root [README.md](./README.md); machine-oriented discovery lives under `public/.well-known/`.

## Read first

| What | Path |
|------|------|
| Repo rules for edits (stack, folders, API scopes) | [`.cursorrules`](./.cursorrules) |
| Human docs index (build, Farcaster, OpenServ, Supabase runbooks) | [`docs/README.md`](./docs/README.md) |
| Edge Functions catalogue | [`supabase/functions/README.md`](./supabase/functions/README.md) |
| Supabase layout (migrations vs functions) | [`supabase/README.md`](./supabase/README.md) |

## Runtime URLs (do not rename paths on the site)

| Resource | Production URL |
|----------|----------------|
| **Onboarding (humans + agents)** | `https://loyalspark.online/for-agents` |
| Agent manifest | `https://loyalspark.online/.well-known/agent.json` |
| Skills (Markdown) | `https://loyalspark.online/.well-known/skills/index.md` |
| OpenAPI | `https://loyalspark.online/openapi.json` |
| Short LLM summary | `https://loyalspark.online/llms.txt` |
| Long LLM reference | `https://loyalspark.online/llms-full.txt` |

Source files for the above: `public/.well-known/`, `public/openapi.json`, `public/llms.txt`, `public/llms-full.txt`.

Copy-paste MCP and curl: **[examples/agent-mcp/](./examples/agent-mcp/)** · Short repo quickstart: **[docs/agents/QUICKSTART.md](./docs/agents/QUICKSTART.md)**.

## API & MCP (source of truth)

- **REST:** `supabase/functions/agent-api/index.ts` — count routes here if docs disagree.
- **MCP:** `supabase/functions/loyalty-mcp/index.ts` — each `mcpServer.tool("name", …)` is one tool.

## Prompts & OpenServ

- [`docs/integrations/PROMPT_GUIDE.md`](./docs/integrations/PROMPT_GUIDE.md) — copy-paste system prompts.
- [`docs/integrations/OPENSERV_AGENTS_SETUP.md`](./docs/integrations/OPENSERV_AGENTS_SETUP.md) — OpenServ-oriented notes (see disclaimer there about files not shipped in this repo).
