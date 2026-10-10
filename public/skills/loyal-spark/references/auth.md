# Authentication — Two Personas

Loyal Spark uses two distinct API key prefixes for two different roles. Pick the right one before any call.

## `lsk_…` — Merchant agent

- Issues loyalty programs, mints tokens, manages rewards, runs analytics, issues gift certificates.
- Required for `agent-api/*` and `loyalty-mcp` (merchant MCP, 39 tools).
- Direct `agent-api` exception: `GET /vouchers/status` works without a key.
- Paid-gateway exceptions are listed under Header. Direct `loyalty-mcp` tool `get_platform_info` also answers without a key and without a payment. Direct `list_marketplace_offers` still requires `lsk_` unless the call comes through the paid gateway with no key.

How to get one:

1. **Dashboard (humans):** sign in at https://loyalspark.online/merchant → "AI Agents" tab → register → copy `lsk_…` (shown once).
2. **Autonomous (no browser, SIWE):** `POST https://api.loyalspark.online/siwe-nonce` → sign an EIP-4361 message that contains the exact phrase `Register Loyal Spark merchant agent` and `Chain ID: 8453` → `POST https://api.loyalspark.online/agent-register-siwe` with `{ message, signature, name, scopes }`. The response includes `lsk_…` once. `POST /siwe-verify` is human wallet login and does not issue an API key. Same plan limits as the dashboard. Full steps: https://loyalspark.online/.well-known/skills/00-getting-started.md

## `rwk_…` — Recipient agent (token holder)

- Wallet that **holds** loyalty tokens. Reads its own balances/vouchers, redeems rewards, trades on P2P, claims gift certificates.
- Required for `recipient-api/*` and `recipient-loyalty-mcp` (recipient MCP, 20 tools), except the paid-gateway reads listed under Header.

How to get one: `POST https://api.loyalspark.online/siwe-nonce`, sign a SIWE message for the holder wallet, then `POST https://api.loyalspark.online/recipient-api/register` with `{ message, signature, name }`. The response includes `rwk_…` once. The server does not require a special phrase. This is not `siwe-verify` and not `agent-register-siwe`.

## Header

Both keys are sent the same way:

```
x-api-key: lsk_…   # or rwk_…
```

On a paid x402 or MPP retry, send this header on the **same** request as the payment for every route except the five public reads below. Merchant routes use `lsk_`. Holder routes use `rwk_`. A payment without that live key returns 401 and is not charged. The first unpaid request stays 402 so the agent can read the price.

These five public reads accept the payment alone. Do not send `x-api-key` on them. If a key is present, it is checked, so a dead key is charged and then rejected.

- `GET /x402-gateway/offers` and `GET /mpp-gateway/offers`
- `GET /x402-gateway/recipient-api/offers` and `GET /mpp-gateway/recipient-api/offers`
- `POST /x402-gateway/mcp-tools/get_platform_info`
- `POST /x402-gateway/mcp-tools/list_marketplace_offers`
- `POST /x402-gateway/recipient-mcp-tools/list_p2p_offers`

## Scopes (merchant `lsk_`)

| Scope | Endpoints |
| --- | --- |
| `read` | profile, programs, rewards, balances, vouchers, analytics, marketplace, redeem |
| `mint` | deploy / register / activate program, mint, earn, transfer, status updates |
| `manage_rewards` | create rewards, mark vouchers used, manage gift certificates, merchant profile writes |
| `trade` | create/accept/cancel P2P marketplace offers |

A single `lsk_` key can have any combination. Check `GET /me` for the granted scope set.
