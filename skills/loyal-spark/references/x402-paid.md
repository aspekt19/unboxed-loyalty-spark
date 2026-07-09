# Paid Routes via x402 and MPP

Loyal Spark exposes two pay-per-request corridors in addition to the API-key flow. Either one is fine — pick what the user's harness already supports.

## x402 (Coinbase HTTP 402 protocol)

- Gateway: `https://api.loyalspark.online/x402-gateway`
- Currency: **USDC on Base** (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`), CAIP-2 `eip155:8453`.
- Facilitator: Coinbase CDP (`https://api.cdp.coinbase.com/platform/v2/x402`) in production.
- Resource catalog (canonical): https://api.loyalspark.online/.well-known/x402 — live Bazaar discovery origin for x402scan; includes merchant and recipient corridors.
- Static mirror (same URLs): https://loyalspark.online/.well-known/x402.json

### Paid REST

`POST https://api.loyalspark.online/x402-gateway/<route>` (e.g. `/mint`, `/transfer`, `/offers`). Header `x-api-key: lsk_…` (or `rwk_…`) **after** payment settles.

### Paid MCP

`POST https://api.loyalspark.online/x402-gateway/mcp-tools/<tool_name>` with a JSON-RPC `tools/call` body. Recipient equivalent: `/recipient-mcp-tools/<tool_name>`.

The 402 response body includes `extensions.bazaar` metadata so x402-compatible clients can auto-pay. Tool ids and argument schemas live in the repo at `supabase/functions/_shared/mcp-bazaar-tools.ts` (merchant) and `_shared/recipient-mcp-bazaar-tools.ts` (recipient).

### Payment safety

- Gateway returns 404 for unknown routes (no silent free proxy).
- Settlement is a hard gate: if facilitator settlement fails, the gateway returns 402 with `X-Payment-Error: Settlement failed` and does **not** forward the upstream response.

## MPP (Machine Payments Protocol)

- Gateway: `https://api.loyalspark.online/mpp-gateway`
- Currency: **pathUSD on Tempo** (also accepts USDC `0x20C0…b50`).
- Manifest: https://loyalspark.online/.well-known/mpp.json
- SDK: `npm install -g mppx`

Same 404-on-unknown-route rule applies — only mapped routes are proxied.

## When to use which

| Situation | Pick |
| --- | --- |
| Already paying through Coinbase x402 / Bazaar | x402 |
| Tempo / pathUSD wallet | MPP |
| Have a long-lived `lsk_` / `rwk_` key on a plan | Direct API key (no gateway) |

Pricing per route is published in the manifests above. Quote the price to the user **before** spending their funds.
