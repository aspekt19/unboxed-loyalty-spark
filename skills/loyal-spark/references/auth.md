# Authentication — Two Personas

Loyal Spark uses two distinct API key prefixes for two different roles. Pick the right one before any call.

## `lsk_…` — Merchant agent

- Issues loyalty programs, mints tokens, manages rewards, runs analytics, issues gift certificates.
- Required for `agent-api/*` and `loyalty-mcp` (merchant MCP, 32 tools).
- Only public exception: `GET /vouchers/status` works without a key.

How to get one:

1. **Dashboard (humans):** sign in at https://loyalspark.online/merchant → "AI Agents" tab → register → copy `lsk_…` (shown once).
2. **Autonomous (no browser, SIWE):** `POST /siwe-nonce` → sign EIP-4361 message containing `Register Loyal Spark merchant agent` and Chain ID 8453 → `POST /siwe-verify` → receive `lsk_…`. Same limits as dashboard.

## `rwk_…` — Recipient agent (token holder)

- Wallet that **holds** loyalty tokens. Reads its own balances/vouchers, redeems rewards, trades on P2P, claims gift certificates.
- Required for `recipient-api/*` and `recipient-loyalty-mcp` (recipient MCP, 14 tools).

How to get one: SIWE with message `Register Loyal Spark recipient agent`, same flow.

## Header

Both keys are sent the same way:

```
x-api-key: lsk_…   # or rwk_…
```

For paid x402 routes, the same header is used **after** payment settles.

## Scopes (merchant `lsk_`)

| Scope | Endpoints |
| --- | --- |
| `read` | profile, programs, rewards, balances, vouchers, analytics, marketplace, redeem |
| `mint` | deploy / register / activate program, mint, earn, transfer, status updates |
| `manage_rewards` | create rewards, mark vouchers used, manage gift certificates, merchant profile writes |
| `trade` | create/accept/cancel P2P marketplace offers |

A single `lsk_` key can have any combination. Check `GET /me` for the granted scope set.
