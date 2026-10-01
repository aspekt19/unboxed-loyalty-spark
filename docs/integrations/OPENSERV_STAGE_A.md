# OpenServ Stage A — Analyst workflow (Loyal Spark only)

> **Status:** Active. Protocol pays for OpenServ → **Loyal Spark scope only**.  
> Prompts: [OPENSERV_AGENT_PROMPTS.md](./OPENSERV_AGENT_PROMPTS.md) · Auth: [OPENSERV_MCP_AUTH.md](./OPENSERV_MCP_AUTH.md) · Example runner: [examples/openserv-analyst/](../../examples/openserv-analyst/)

## Goal

Ship one reliable **weekly Analyst** loop that reads Loyal Spark MCP, optionally fixes safe anomalies, and writes `send_report` — with **zero spend** on off-topic chat (weather, news, general crypto, homework).

## Non-negotiables

1. **HARD SCOPE** block in the Analyst system prompt (see prompts file).
2. MCP tools only from `https://api.loyalspark.online/loyalty-mcp` (no web search, no arbitrary HTTP).
3. Prefer `Authorization: Bearer lsk_...` on every MCP request.
4. Off-topic → short refusal, **no tool calls**.
5. Do not invent metrics if a tool errors.

## Prerequisites

| Item | Detail |
|------|--------|
| API key | Admin-wallet `lsk_` with scopes `read` + `manage_rewards` (needed for `get_platform_stats`, `cancel_stale_offers`) |
| MCP URL | `https://api.loyalspark.online/loyalty-mcp` |
| OpenServ | Workspace MCP integration + Analyst agent + scheduled Operations step (or local `examples/openserv-analyst`) |

## Tool whitelist (Stage A)

**Read (every cycle):**  
`get_my_profile`, `get_platform_info`, `get_platform_stats`, `list_loyalty_programs`, `get_program_analytics`, `list_marketplace_offers`, `list_rewards`, `list_my_reports`

**Optional read:**  
`export_customers`, `check_voucher_status`, `get_token_balance`

**Safe writes (only when policy matches):**  
`cancel_stale_offers` (`max_age_days: 7` when enforcing 7-day stale policy), `update_reward_status`, `create_personalized_offer` (dedupe vs last 7 days in reports), `send_report`, `update_report_status`, `delete_report`

**Do not use in Stage A:**  
mint / create_program / activate / bazaar_pay_and_call / gift-certificate minting / anything outside loyalty-mcp.

## Weekly cycle (checklist)

1. Off-topic smoke (manual once after deploy): ask “What’s the weather in Moscow?” → refusal, zero MCP.
2. `list_my_reports` → mark done / delete noise.
3. `get_platform_stats` → platform overview.
4. `list_loyalty_programs` → for each active program `get_program_analytics`.
5. `list_marketplace_offers` → if stale >7d with no completions → `cancel_stale_offers` with `max_age_days: 7`.
6. Optional: `export_customers` inactive/high_value → at most a few `create_personalized_offer` (dedupe).
7. `send_report` with `agent_role: "analyst"`, `report_type: "data_report"`, sections: Platform Overview, Actions Taken, Remaining Issues, Trends.

## Success criteria (Definition of Done)

- [ ] Three scheduled Analyst runs complete without auth errors.
- [ ] Each run produces a `send_report` visible in merchant / admin reports UI.
- [ ] Off-topic probe refuses with **0** MCP calls (check OpenServ / MCP logs).
- [ ] No mint, deploy, or non-LS tools appear in the run log.

## What comes next

- **Stages B–D (in repo):** [OPENSERV_STAGES_BCD.md](./OPENSERV_STAGES_BCD.md) — `chat-bridge`, Merchant/Shopper Concierge UI, pricing packaging.  
- **Concierge prompts:** [OPENSERV_CONCIERGE_PROMPTS.md](./OPENSERV_CONCIERGE_PROMPTS.md).  
- Full CEO/SEO/Growth workflow only after Analyst is green for 2–3 weeks.

## Local smoke (optional)

```bash
cd examples/openserv-analyst
cp .env.example .env   # set LOYAL_SPARK_API_KEY
npm install
npm run smoke          # get_my_profile + off-topic guard unit check
```

OpenServ platform `provision()` / `run()` is optional; Stage A can run entirely as an OpenServ hosted agent using the Analyst prompt — the example folder is a backup runner and CI-friendly smoke.
