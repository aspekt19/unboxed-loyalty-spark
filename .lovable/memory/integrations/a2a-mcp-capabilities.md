---
name: A2A MCP Capabilities
description: Counts of A2A REST endpoints and MCP tools (merchant + recipient corridors)
type: feature
---
Loyal Spark A2A infrastructure exposes:
- **Merchant REST** (`lsk_`, `/agent-api`): 28 authenticated routes + 1 public GET `/vouchers/status` (includes `POST /workflow/generate-program-defaults`, `GET /workflow/program-status`, `POST /mint/confirm`).
- **Recipient REST** (`rwk_`, `/recipient-api`): 14 routes (includes `GET /workflow/reward-status`, `POST /workflow/prepare-reward-redemption`).
- **Merchant MCP** (`/loyalty-mcp`): 39 tools (35 core including `confirm_mint_fee` + 4 Bazaar side-car). Workflow planners: `generate_program_defaults`, `get_program_workflow_status`. Source of truth: `supabase/functions/loyalty-mcp/index.ts`.
- **Recipient MCP** (`/recipient-loyalty-mcp`): 20 tools (16 core + 4 Bazaar side-car). Workflow planners: `get_reward_workflow_status`, `prepare_reward_redemption`. Source of truth: `supabase/functions/recipient-loyalty-mcp/index.ts`.
- Lifecycle-sensitive REST/MCP responses embed a `workflow` object (current_step, completed_steps, next_actions, prerequisites, blocking_reason, suggested_defaults, continuation_context) via `_shared/agent-workflows.ts` — agents can self-orchestrate without pre-reading skills.
- **Bazaar side-car** (outbound discovery, read-only): helper `supabase/functions/_shared/bazaar-discovery.ts`; `bazaar_probe_x402` GETs an HTTPS URL and parses HTTP 402 `accepts[]`.
- **x402 Bazaar discovery** — canonical: `https://api.loyalspark.online/.well-known/x402` (live Edge); static mirror: `public/.well-known/x402.json` on marketing host (~88 paid resource URLs).

Specs (openapi.json, agent.json, mpp.json, llms.txt, llms-full.txt, x402.json) and `well-known-x402` are kept in sync. When adding/removing MCP tools or REST routes, update: tool registry, bazaar-tools file, openapi.json, agent.json, mpp.json, llms*.txt, well-known-x402 description.
