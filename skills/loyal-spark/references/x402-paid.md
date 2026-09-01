# Paid Routes via x402 and MPP

Loyal Spark exposes two pay-per-request corridors in addition to API-key subscriptions. Use the rail your agent already supports; never sign before checking the returned requirements against your own spend policy.

## Decision table

| Situation | Use |
| --- | --- |
| Fixed-price request on Base | **x402 v2 `exact`** |
| Tempo-native machine payment | **MPP** |
| More than 200 calls/month or lower mint fee | **Agent plan subscription** |
| Headless repeated work | Subscription + CDP MPC wallet; reserve x402 for exceptional calls |

## x402 v2 (`exact`) — USDC on Base

- Gateway: `https://api.loyalspark.online/x402-gateway`
- Asset: USDC `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- Network: CAIP-2 `eip155:8453` (Base Mainnet)
- Facilitator: Coinbase CDP in production when the gateway is configured for mainnet settlement
- Discovery: `https://api.loyalspark.online/.well-known/x402`
- Static mirror: `https://loyalspark.online/.well-known/x402.json`

The current gateway advertises **`scheme: "exact"` only**. It does not advertise `upto`, metered capture, refunds, or split payouts. Do not construct an `upto` payload yourself and do not infer a variable price from a fixed-price 402 response.

### Request → authorize → settle → verify

1. **Request** the mapped REST or MCP resource without a payment.
2. Receive HTTP **402** with `PAYMENT-REQUIRED` and a JSON body containing `accepts` plus Bazaar metadata.
3. Validate `scheme`, `network`, `asset`, `payTo`, `amount`, resource URL, and expiry against your spend policy.
4. **Authorize** exactly the advertised amount with an x402-compatible EIP-3009 client.
5. Retry the same request with the generated `X-PAYMENT` / `PAYMENT-SIGNATURE` header.
6. The gateway verifies and settles before proxying. If settlement fails, it returns **402** with `X-Payment-Error: Settlement failed` and does not forward the upstream request.
7. Treat `X-Payment-Response` / `X-Payment-TxHash` as settlement evidence; still inspect the JSON response and keep the payment receipt.

### Paid URLs

```text
POST https://api.loyalspark.online/x402-gateway/<merchant-route>
POST https://api.loyalspark.online/x402-gateway/recipient-api/<holder-route>
POST https://api.loyalspark.online/x402-gateway/mcp-tools/<tool_name>
POST https://api.loyalspark.online/x402-gateway/recipient-mcp-tools/<tool_name>
```

MCP requests use the normal JSON-RPC `tools/call` body. The merchant corridor uses `lsk_`; the holder corridor uses `rwk_` on the paid retry. Paid MCP is a priced subset of the direct MCP catalog; discovery is authoritative.

### Safe retry rules

- Reuse the same authorization for a network retry; never sign a second payment for the same request until you know the first was not settled.
- Unknown routes return **404** and are never silently proxied for free.
- A successful payment does not make a failed business operation successful; inspect the upstream status and retain the settlement tx hash.
- Never accept a different recipient, asset, chain, amount, or resource URL from a client-modified payment payload.

## MPP — Tempo

- Gateway: `https://api.loyalspark.online/mpp-gateway`
- Manifest: `https://loyalspark.online/.well-known/mpp.json`
- Supported currencies: pathUSD and the published Tempo USDC currency
- SDK: `npm install -g mppx`

MPP follows `Request → 402 challenge → authorize → retry with credential → receipt`. The gateway maps the same merchant and recipient REST corridors, uses the published route price, and returns **404** for unknown routes. Use MPP when the agent already has a Tempo-compatible wallet; do not send Base USDC credentials to the Tempo rail.

## Agent subscriptions — USDC on Base

Subscriptions replace per-call charges for recurring use and also change the mint commission entitlement:

| Plan | Price | API calls/month | Agents | Mint fee |
|------|-------|-----------------|--------|----------|
| Free | $0 | 200 | 1 | 1.25% |
| Pro | $49 USDC/month | 10,000 | 5 | 0.50% |
| Enterprise | $129 USDC/month | Unlimited | Unlimited | 0.25% |

Flow: open `https://loyalspark.online/for-agents/subscribe`, connect the owner wallet on Base, choose a plan and monthly or annual cycle, then confirm one USDC transfer. The application verifies the transaction and activates the subscription automatically; `retry_verification` is available for a still-propagating receipt. Annual billing discounts are published on the pricing page.

Subscription payment and per-call payment are separate:
- Subscription: USDC transfer to the published subscription wallet.
- x402: USDC per mapped request on Base.
- MPP: pathUSD or Tempo USDC per mapped request.
- Mint commission: the agent's own loyalty token, issued as a separate fee mint; it is not USDC, ETH, or fiat.

## CDP wallet payment

For an autonomous merchant or recipient, `bazaar_pay_and_call` can pay and call a discovered x402 resource through the agent's delegated CDP MPC wallet. It is opt-in, has a spend cap of **10 USDC per call**, and is separate from `agent-wallet` signing of loyalty calldata. Discovery and the tool's returned constraints remain authoritative.

## Not currently offered by these gateways

The Base payments lifecycle also describes variable `upto` authorizations, partial capture, void, refund, payout, and split payments. Loyal Spark's current public x402/MPP gateways do not expose those as customer-callable operations. A client must not document or emulate them as if they were available.

## Next references

- [B20 Native Spec](../../.well-known/skills/14-b20-native-spec.md)
- [Base MCP integration](./base-mcp-integration.md)
- [Calldata flow](./calldata-flow.md)
