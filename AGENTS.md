# AI agents — where to look

This file is the **entry point** for coding agents (Cursor, OpenServ, Claude Code, and so on). Human product copy stays in the root [README.md](./README.md); machine-oriented discovery lives under `public/.well-known/`.

## Read first

| What | Path |
|------|------|
| **Paid MCP via x402** | Merchant tools: [`mcp-bazaar-tools.ts`](./supabase/functions/_shared/mcp-bazaar-tools.ts) · recipient tools: [`recipient-mcp-bazaar-tools.ts`](./supabase/functions/_shared/recipient-mcp-bazaar-tools.ts) · HTTP 402 + **Bazaar** metadata: [`x402-bazaar-accept.ts`](./supabase/functions/_shared/x402-bazaar-accept.ts) · quickstart [`docs/agents/QUICKSTART.md`](./docs/agents/QUICKSTART.md) |
| **Free `lsk_` without web login (SIWE)** | [`docs/agents/AUTONOMOUS_AGENT_REGISTRATION.md`](./docs/agents/AUTONOMOUS_AGENT_REGISTRATION.md) |
| **Monetization & public pricing (merchant + agents)** | [`docs/business/MONETIZATION_AND_PRICING.md`](./docs/business/MONETIZATION_AND_PRICING.md) |
| **Distributable skill bundle (Base / Claude / ChatGPT)** | Source: [`skills/loyal-spark/`](./skills/loyal-spark) (16 guides in `/.well-known/skills/` `00`–`15`) · Submission guide: [`docs/agents/BASE_SKILLS_SUBMISSION.md`](./docs/agents/BASE_SKILLS_SUBMISSION.md) |
| Repo rules for edits (stack, folders, API scopes) | [`.cursorrules`](./.cursorrules) |
| Human docs index (build, Farcaster, OpenServ, Supabase runbooks) | [`docs/README.md`](./docs/README.md) |
| Merchant / customer portal UI & team invites | [`docs/development/PORTALS_AND_TEAM.md`](./docs/development/PORTALS_AND_TEAM.md) |
| B20 vs legacy ERC-20 program deploy | [`docs/development/LOYALTY_PROGRAM_CONTRACTS.md`](./docs/development/LOYALTY_PROGRAM_CONTRACTS.md) |
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

`openapi.json` `servers[]` lists **only** `api.loyalspark.online`. Sources: `public/.well-known/`, `public/openapi.json`, `public/llms*.txt`.

Copy-paste MCP/curl: [examples/agent-mcp/](./examples/agent-mcp/) (`lsk_`) · [examples/recipient-agent-mcp/](./examples/recipient-agent-mcp/) (`rwk_`). Local-only scripts: `scripts/x402-paid-mcp-test/`, `scripts/agent-register-siwe/`.

## API & MCP source of truth

See [`supabase/functions/AGENTS.md`](./supabase/functions/AGENTS.md) (REST/MCP route files, Base MCP plugin, Concierge rules).

## Prompts & OpenServ

All in `docs/integrations/`: `PROMPT_GUIDE.md` (system prompts), `OPENSERV_AGENTS_SETUP.md`, `OPENSERV_STAGE_A.md` (weekly Analyst, Loyal Spark-only scope), `OPENSERV_STAGES_BCD.md` (chat-bridge, Concierge UI), `OPENSERV_CONCIERGE_PROMPTS.md`, `OPENSERV_AGENT_PROMPTS.md` (CEO/SEO/Growth/Analyst, HARD SCOPE).
- Concierge mobile layout is guarded by `e2e/concierge-mobile-layout.spec.ts` against the test-only `/__test/concierge-layout` route (dev or `VITE_E2E=1` builds) — catches cut-off chat UI on phone sizes before release.

## CI

- `useIdentity` owns pre-session Google/OTP pending UI without verifying OAuth or editing callback URLs; this prevents duplicate sign-in during SDK hydration.

- CI runs `npm ci`, falling back to `npm install` if `package-lock.json` drifts — why: Lovable updates only `bun.lock`.

- Lazy-load token-themed 3D; pause offscreen/reduced motion to preserve usability.
