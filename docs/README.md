# Documentation index

Human-oriented guides and plans live under `docs/`. **Runtime discovery** for AI agents stays in `public/.well-known/` and `public/openapi.json` (URLs on https://loyalspark.online must stay stable).

## For AI / coding agents

Start at the repo root **[AGENTS.md](../AGENTS.md)** (links to rules, APIs, and discovery files). Editor/repo rules live in **[`.cursorrules`](../.cursorrules)**.

## Layout

| Path | Contents |
|------|----------|
| [agents/](./agents/) | [Quickstart](./agents/QUICKSTART.md), [autonomous `lsk_` (SIWE)](./agents/AUTONOMOUS_AGENT_REGISTRATION.md), [Base / Claude / ChatGPT skill distribution](./agents/BASE_SKILLS_SUBMISSION.md); x402 MCP: `mcp-bazaar-tools.ts`, `recipient-mcp-bazaar-tools.ts`, `x402-bazaar-accept.ts` (Bazaar metadata on 402) |
| [development/](./development/) | Build, deploy, Capacitor; [PORTALS_AND_TEAM.md](./development/PORTALS_AND_TEAM.md) (`/merchant`, `/customer`, team RPC) |
| [integrations/](./integrations/) | Farcaster, OpenServ, A2A, prompts, adaptation plans |
| [pitch-deck/](./pitch-deck/) | Investor deck source notes (Markdown); live UI route: `/pitch` |
| [supabase/](./supabase/) | Supabase-specific runbooks (e.g. expiration cron) |

## Business & pricing

- [Monetization & public pricing](./business/MONETIZATION_AND_PRICING.md) · [Action plan](./business/ACTION_PLAN_MONETIZATION.md) · [Grandfathering & admin wallets](./business/GRANDFATHERING_AND_ADMINS.md)

## Quick links

- [AI agents — repo quickstart](./agents/QUICKSTART.md) · [SIWE `lsk_` (no web login)](./agents/AUTONOMOUS_AGENT_REGISTRATION.md) · live **[/for-agents](https://loyalspark.online/for-agents)** · paid MCP/x402: `mcp-bazaar-tools.ts`, `recipient-mcp-bazaar-tools.ts`, `x402-bazaar-accept.ts`
- [Native / Capacitor build](./development/NATIVE_BUILD_GUIDE.md)
- [Merchant & customer portals — header, Profile, team invites](./development/PORTALS_AND_TEAM.md)
- [Round-Up contracts (legacy filename)](./development/DEPLOYMENT_INSTRUCTIONS.md) — Solidity deploy steps, not the web app
- [Farcaster](./integrations/FARCASTER_APP_README.md)
- [OpenServ agents setup](./integrations/OPENSERV_AGENTS_SETUP.md)
- [OpenServ MCP auth troubleshooting](./integrations/OPENSERV_MCP_AUTH.md)
- [OpenServ prompts](./integrations/OPENSERV_AGENT_PROMPTS.md)
- [Prompt guide (LLMs)](./integrations/PROMPT_GUIDE.md)
- [A2A integration plan](./integrations/A2A_INTEGRATION_PLAN.md)
- [UDS adaptation plan](./integrations/UDS_ADAPTATION_PLAN.md)
- [Program / voucher expiration](./supabase/EXPIRATION_SETUP.md)
- [Edge Functions catalogue](../supabase/functions/README.md)

## Repository map

| Path | Role |
|------|------|
| `src/` | React + TypeScript app: domain UI under `components/`, routes under `pages/`, Supabase data access under `hooks/` (not inline in presentational components) |
| `public/` | Static assets; **agent** manifests (`openapi.json`, `llms.txt`, `.well-known/`) — treat as public API surface |
| `supabase/migrations/` | Postgres schema & RLS (includes `accept_merchant_invite` for team joins — see PORTALS_AND_TEAM) |
| `supabase/functions/` | Deno Edge Functions — one deployable folder per function |
| `contracts/` | Solidity sources |
| `capacitor.config.ts`, `ios/`, `android/` | Native shells (after `npx cap add`) |
| `.cursorrules` | Cursor / agent coding conventions for this repo |
| `.lovable/` | Lovable IDE metadata (optional; safe to ignore for builds) |

**Indexes:** this file (human guides) · [AGENTS.md](../AGENTS.md) (agents) · [supabase/functions/README.md](../supabase/functions/README.md) (API backend catalogue).
