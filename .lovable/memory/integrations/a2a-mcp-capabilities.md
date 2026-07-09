---
name: A2A MCP Capabilities
description: Counts of A2A REST endpoints and MCP tools (merchant + recipient corridors)
type: feature
---
Loyal Spark A2A infrastructure exposes:
- **Merchant REST** (`lsk_`, `/agent-api`): 25 routes (adds `POST /workflow/generate-program-defaults`, `GET /workflow/program-status`).
- **Recipient REST** (`rwk_`, `/recipient-api`): 14 routes (adds `GET /workflow/reward-status`, `POST /workflow/prepare-reward-redemption`).
- **Merchant MCP** (`/loyalty-mcp`): 37 tools (34 core + 3 Bazaar side-car). New workflow planners: `generate_program_defaults`, `get_program_workflow_status`. Registry: `src/constants/mcpToolNames.ts`.
- **Recipient MCP** (`/recipient-loyalty-mcp`): 19 tools (16 core + 3 Bazaar side-car). New workflow planners: `get_reward_workflow_status`, `prepare_reward_redemption`. Registry: `src/constants/recipientMcpToolNames.ts`.
- Lifecycle-sensitive REST/MCP responses embed a `workflow` object (current_step, completed_steps, next_actions, prerequisites, blocking_reason, suggested_defaults, continuation_context) via `_shared/agent-workflows.ts` — agents can self-orchestrate without pre-reading skills.
- **Bazaar side-car** (outbound discovery, read-only): helper `supabase/functions/_shared/bazaar-discovery.ts`; `bazaar_probe_x402` GETs an HTTPS URL and parses HTTP 402 `accepts[]`.
- **x402 Bazaar discovery** — canonical: `https://api.loyalspark.online/.well-known/x402` (live Edge); static mirror: `public/.well-known/x402.json` on marketing host (~88 paid resource URLs).

Specs (openapi.json, agent.json, mpp.json, llms.txt, llms-full.txt, x402.json) and `well-known-x402` are kept in sync. When adding/removing MCP tools or REST routes, update: tool registry, bazaar-tools file, openapi.json, agent.json, mpp.json, llms*.txt, well-known-x402 description.
