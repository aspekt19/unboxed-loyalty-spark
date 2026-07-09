# AI agents — where to look

This file is the **entry point** for coding agents (Cursor, OpenServ, Claude Code, and so on). Human product copy stays in the root [README.md](./README.md); machine-oriented discovery lives under `public/.well-known/`.

## Read first

| What | Path |
|------|------|
| **Paid MCP via x402** | Merchant tools: [`mcp-bazaar-tools.ts`](./supabase/functions/_shared/mcp-bazaar-tools.ts) · recipient tools: [`recipient-mcp-bazaar-tools.ts`](./supabase/functions/_shared/recipient-mcp-bazaar-tools.ts) · HTTP 402 + **Bazaar** metadata: [`x402-bazaar-accept.ts`](./supabase/functions/_shared/x402-bazaar-accept.ts) · quickstart [`docs/agents/QUICKSTART.md`](./docs/agents/QUICKSTART.md) |
| **Free `lsk_` without web login (SIWE)** | [`docs/agents/AUTONOMOUS_AGENT_REGISTRATION.md`](./docs/agents/AUTONOMOUS_AGENT_REGISTRATION.md) |
| **Monetization & public pricing (merchant + agents)** | [`docs/business/MONETIZATION_AND_PRICING.md`](./docs/business/MONETIZATION_AND_PRICING.md) |
| **Distributable skill bundle (Base / Claude / ChatGPT)** | Source: [`skills/loyal-spark/`](./skills/loyal-spark) · Submission guide: [`docs/agents/BASE_SKILLS_SUBMISSION.md`](./docs/agents/BASE_SKILLS_SUBMISSION.md) |
| Repo rules for edits (stack, folders, API scopes) | [`.cursorrules`](./.cursorrules) |
| Human docs index (build, Farcaster, OpenServ, Supabase runbooks) | [`docs/README.md`](./docs/README.md) |
| Merchant / customer portal UI & team invites | [`docs/development/PORTALS_AND_TEAM.md`](./docs/development/PORTALS_AND_TEAM.md) |
| Edge Functions catalogue | [`supabase/functions/README.md`](./supabase/functions/README.md) |
| Supabase layout (migrations vs functions) | [`supabase/README.md`](./supabase/README.md) |

## Two production hosts (do not conflate)

| Host | Role |
|------|------|
| **`https://loyalspark.online`** | Public website (Vite/Lovable): marketing, portals, static discovery files (`agent.json`, `openapi.json`, `llms.txt`, skills markdown, logos). |
| **`https://api.loyalspark.online`** | API proxy only — replaces `https://bzxmejzssxjazswgwqqs.supabase.co/functions/v1` for REST, MCP, x402, MPP, SIWE, and x402 discovery origin. |

**`PUBLIC_BASE_URL`** (Supabase secret) must be **`https://api.loyalspark.online`** — it affects **paid resource URLs** in Edge Functions (`x402-bazaar-accept.ts`, `well-known-x402`), not the marketing site. Bazaar `website` / `documentation` metadata still point at `loyalspark.online`. See [`.lovable/memory/integrations/api-proxy-domain.md`](./.lovable/memory/integrations/api-proxy-domain.md).

## Runtime URLs (do not rename paths on the site)

| Resource | Production URL |
|----------|----------------|
| **Onboarding (humans + agents)** | `https://loyalspark.online/for-agents` |
| Agent manifest | `https://loyalspark.online/.well-known/agent.json` |
| Skills (Markdown) | `https://loyalspark.online/.well-known/skills/index.md` |
| OpenAPI | `https://loyalspark.online/openapi.json` |
| Short LLM summary | `https://loyalspark.online/llms.txt` |
| Long LLM reference | `https://loyalspark.online/llms-full.txt` |
| **Merchant REST** | `https://api.loyalspark.online/agent-api` |
| **Merchant MCP** | `https://api.loyalspark.online/loyalty-mcp` |
| **x402 / MPP gateways** | `https://api.loyalspark.online/x402-gateway` · `…/mpp-gateway` |
| **x402 discovery (origin for x402scan)** | `https://api.loyalspark.online/.well-known/x402` |
| x402 static mirror | `https://loyalspark.online/.well-known/x402.json` |

`openapi.json` is served from the marketing host but `servers[]` lists **only** `api.loyalspark.online` (no `supabase.co` second entry).

Source files for the above: `public/.well-known/`, `public/openapi.json`, `public/llms.txt`, `public/llms-full.txt`.

Copy-paste MCP and curl: **[examples/agent-mcp/](./examples/agent-mcp/)** (merchant `lsk_`) · **[examples/recipient-agent-mcp/](./examples/recipient-agent-mcp/)** (holder `rwk_`) · Short repo quickstart: **[docs/agents/QUICKSTART.md](./docs/agents/QUICKSTART.md)**.

Optional **local** scripts (not used by the web app build): **`scripts/x402-paid-mcp-test/`** (paid MCP smoke test), **`scripts/agent-register-siwe/`** (SIWE → `lsk_` helper) — documented in **[README.md](./README.md)** (section “Optional repo scripts”) and **docs/agents/**.

## API & MCP (source of truth)

- **REST (merchants):** `supabase/functions/agent-api/index.ts` — count routes here if docs disagree.
- **MCP (merchants):** `supabase/functions/loyalty-mcp/index.ts` — each `mcpServer.tool("name", …)` is one tool.
- **REST (recipients):** `supabase/functions/recipient-api/index.ts` — wallet-bound `rwk_` keys (balances, rewards, vouchers, redeem, **`POST /prepare-transfer`** for holder ERC-20 send calldata, P2P offers list/create/accept/cancel). **Paid corridor:** `mpp-gateway` / `x402-gateway` + paths in `_shared/recipient-paid-routes.ts`.
- **MCP (recipients):** `supabase/functions/recipient-loyalty-mcp/index.ts` — holder tools including **`prepare_loyalty_token_transfer`** (same calldata path as merchant `transfer_loyalty_tokens`, but authenticated with `rwk_`) and P2P (`list_p2p_offers`, `create_p2p_offer`, `accept_p2p_offer`, `cancel_p2p_offer`). **Paid x402 MCP:** `x402-gateway/recipient-mcp-tools/<name>` — prices in `_shared/recipient-mcp-bazaar-tools.ts`.
- **Base MCP custom plugin (calldata → `send_calls`):** `supabase/functions/agent-prepare/index.ts` — GET endpoints at `https://api.loyalspark.online/agent-prepare/<action>` returning `{ chainId, description, transactions:[{to,data,value}], builder_code }` for Base MCP `send_calls`. Actions: `create-program`, `activate-program`, `mint`, `transfer` (`lsk_`) · `recipient-transfer`, `recipient-approve` (`rwk_`). Plugin spec: `skills/loyal-spark/plugins/loyal-spark.md`.


## Prompts & OpenServ

- [`docs/integrations/PROMPT_GUIDE.md`](./docs/integrations/PROMPT_GUIDE.md) — copy-paste system prompts.
- [`docs/integrations/OPENSERV_AGENTS_SETUP.md`](./docs/integrations/OPENSERV_AGENTS_SETUP.md) — OpenServ-oriented notes (see disclaimer there about files not shipped in this repo).
