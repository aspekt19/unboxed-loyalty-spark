# Documentation index

Human-oriented guides and plans live under `docs/`. **Runtime discovery** for AI agents stays in `public/.well-known/` and `public/openapi.json` (URLs must not move).

## Layout

| Path | Contents |
|------|----------|
| [development/](./development/) | Build, deploy, local native app |
| [integrations/](./integrations/) | Farcaster, OpenServ, A2A, prompts, adaptation plans |
| [pitch-deck/](./pitch-deck/) | Investor deck source notes (Markdown); live UI route: `/pitch` |
| [supabase/](./supabase/) | Supabase-specific runbooks (e.g. expiration cron) |

## Quick links

- [Native / Capacitor build](./development/NATIVE_BUILD_GUIDE.md)
- [Deployment](./development/DEPLOYMENT_INSTRUCTIONS.md)
- [Farcaster](./integrations/FARCASTER_APP_README.md)
- [OpenServ agents setup](./integrations/OPENSERV_AGENTS_SETUP.md)
- [OpenServ prompts](./integrations/OPENSERV_AGENT_PROMPTS.md)
- [Prompt guide (LLMs)](./integrations/PROMPT_GUIDE.md)
- [A2A integration plan](./integrations/A2A_INTEGRATION_PLAN.md)
- [UDS adaptation plan](./integrations/UDS_ADAPTATION_PLAN.md)
- [Program / voucher expiration](./supabase/EXPIRATION_SETUP.md)
- [Edge Functions catalogue](../supabase/functions/README.md)

## Repository map (short)

- `src/` — React app (domain folders under `components/`, routes under `pages/`, data in `hooks/`)
- `supabase/functions/` — Deno Edge Functions (one folder per function; see README there)
- `supabase/migrations/` — SQL migrations
- `public/` — Static assets and **agent-facing** manifests (do not move without updating live URLs)
- `contracts/` — Solidity
