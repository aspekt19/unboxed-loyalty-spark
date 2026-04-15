# Supabase Edge Functions

Each subdirectory is one deployable function (`index.ts` entry). Shared Deno modules live in **`_shared/`** (import with `../_shared/...` from a function folder).

**Postgres (not Edge):** merchant team join uses RPC `accept_merchant_invite` in `supabase/migrations/` — see [docs/development/PORTALS_AND_TEAM.md](../../docs/development/PORTALS_AND_TEAM.md).

## Core API and agents

| Folder | Role |
|--------|------|
| `agent-api` | REST API for AI agents (CRUD, calldata, mint commission fields) |
| `loyalty-mcp` | MCP server (JSON-RPC) for LLM tools |
| `recipient-api` | REST for wallet-bound recipient agents (`rwk_` keys, SIWE registration) |
| `recipient-loyalty-mcp` | MCP tools for loyalty token recipients only |
| `agent-wallet` | CDP MPC wallet lifecycle and server-side mint |
| `agent-api-key` | API key issuance / rotation |
| `agent-reports` | Merchant reporting |

## Auth and payments

| Folder | Role |
|--------|------|
| `siwe-verify` | SIWE message verification |
| `siwe-nonce` | Nonce for SIWE |
| `verify-payment` | Premium / subscription USDC checks |
| `verify-agent-plan-payment` | Agent plan payment |
| `verify-voucher` | Voucher verification |
| `mpp-gateway` | MPP pay-per-request proxy to `agent-api` |
| `x402-gateway` | x402 USDC on Base proxy to `agent-api` |

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
