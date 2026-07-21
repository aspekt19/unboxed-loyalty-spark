# Supabase Edge Functions

Each subdirectory is one deployable function (`index.ts` entry). Shared Deno modules live in **`_shared/`** (import with `../_shared/...` from a function folder).

**Postgres (not Edge):** merchant team join uses RPC `accept_merchant_invite` in `supabase/migrations/` — see [docs/development/PORTALS_AND_TEAM.md](../../docs/development/PORTALS_AND_TEAM.md).

**MCP HTTP auth:** `loyalty-mcp` and `recipient-loyalty-mcp` accept `x-api-key` **or** `Authorization: Bearer <lsk_…>` / `<rwk_…>` (some hosts only forward Bearer). See [docs/integrations/OPENSERV_MCP_AUTH.md](../../docs/integrations/OPENSERV_MCP_AUTH.md).

**Rate limits:** Merchant (`lsk_`) and recipient (`rwk_`) keys share free-tier **200 API calls/month** (`agent_usage`), plus per-minute throttling. See [docs/business/MONETIZATION_AND_PRICING.md](../../docs/business/MONETIZATION_AND_PRICING.md).

## Core API and agents

| Folder | Role |
|--------|------|
| `agent-api` | REST API for AI agents (CRUD, calldata, mint commission fields) |
| `loyalty-mcp` | MCP server (JSON-RPC) for LLM tools |
| `recipient-api` | REST for wallet-bound recipient agents (`rwk_` keys, SIWE registration; includes `POST /prepare-transfer` for holder token sends) |
| `agent-prepare` | GET-friendly calldata for Base MCP `send_calls` (Builder Code baked in); merchant actions with `lsk_`, holder actions with `rwk_` |
| `recipient-loyalty-mcp` | MCP tools for loyalty token recipients only |
| `agent-wallet` | CDP MPC wallet lifecycle and server-side mint |
| `agent-api-key` | API key issuance / rotation (dashboard, JWT) |
| `agent-register-siwe` | **Free `lsk_` registration via SIWE** (no web login; same limits as dashboard) |
| `agent-reports` | Merchant reporting |

## Auth and payments

| Folder | Role |
|--------|------|
| `siwe-verify` | SIWE message verification |
| `siwe-nonce` | Nonce for SIWE |
| `verify-payment` | Premium / subscription USDC checks |
| `verify-agent-plan-payment` | USDC subscription verification for **agent** and **merchant** plans (`product` in body; same `payment_settings.subscription_wallet_address`) |
| `verify-voucher` | Voucher verification |
| `mpp-gateway` | MPP pay-per-request proxy to `agent-api` and **`recipient-api`** (see `_shared/recipient-paid-routes.ts`) |
| `x402-gateway` | x402 USDC on Base proxy to `agent-api`, **`recipient-api`**, **`loyalty-mcp`** / **`recipient-loyalty-mcp`** (`mcp-tools/*`, `recipient-mcp-tools/*`). Pricing + JSON Schemas: `mcp-bazaar-tools.ts`, `recipient-mcp-bazaar-tools.ts`, `recipient-paid-routes.ts`. **Bazaar (discovery) fields** on HTTP 402: `_shared/x402-bazaar-accept.ts` — MCP routes emit `extensions.bazaar` + `outputSchema.input.type: "mcp"` for both merchant and recipient tool paths. |

## Jobs, sync, exports

| Folder | Role |
|--------|------|
| `check-premium-expiration` | Subscription expiry |
| `check-program-expiration` | Loyalty program expiry |
| `sync-mint-history` | Onchain mint history sync |
| `process-automation` | Automation triggers |
| `customer-export` | CRM export |
| `get-token-holders` | Holder analytics |

## Other

| Folder | Role |
|--------|------|
| `frame` | Farcaster frame |
| `miniapp-webhook` | Miniapp webhooks |
| `tests` | Integration checks (optional env) |

See root **[README.md](../../README.md)** for product overview and **[docs/README.md](../../docs/README.md)** for human docs.
