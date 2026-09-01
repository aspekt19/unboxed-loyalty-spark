# Payment Scenarios for Agents (x402 · MPP · subscriptions)

Pick and execute the right payment corridor when an agent pays Loyal Spark — per call or per month — following the Base accept-payments model.

## 0. Decide the corridor

| Situation | Use |
|-----------|-----|
| Agent already has an `lsk_` / `rwk_` key and a plan | **API key** — no payment per call |
| One-off call with a published fixed price | **x402 v2 `exact`** |
| Harness speaks MPP / Tempo | **MPP gateway** |
| Recurring monthly quota and lower mint fee | **Agent plan subscription in USDC** |
| Variable amount, partial capture, refund, payout, or split | **Not exposed** — do not emulate |

Write actions on x402/MPP still need a free **`lsk_`** or **`rwk_`** key for identity and scopes; the gateway covers the per-call USDC/pathUSD fee only.

## 1. Loyal Spark fixed-price lifecycle

```
Request → 402 challenge → Authorize exact amount → Settle → Retry request
```

Unknown routes return **404**. Failed settlement returns **402** and is not proxied upstream.

## 2. x402 `exact`

```text
GET  https://api.loyalspark.online/.well-known/x402
POST https://api.loyalspark.online/x402-gateway/mint
POST https://api.loyalspark.online/x402-gateway/mcp-tools/<tool_name>
POST https://api.loyalspark.online/x402-gateway/recipient-mcp-tools/<name>
```

- USDC on Base `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`, CAIP-2 `eip155:8453`.
- Gateway advertises **`scheme: "exact"` only** — no `upto`, metered capture, refund, or split.

## 3. MPP

- Gateway: `https://api.loyalspark.online/mpp-gateway`
- Manifest: `https://loyalspark.online/.well-known/mpp.json`
- pathUSD or Tempo USDC — not Base USDC.

## 4. Subscriptions

| Plan | Price | API calls/mo | Agents | Mint cap / fee |
|------|-------|--------------|--------|----------------|
| Free | $0 | 200 | 1 | 1,000 tokens/mo · 1.25% mint fee |
| Pro | $49 USDC | 10,000 | 5 | Unlimited mint · 0.5% |
| Enterprise | $129 USDC | Unlimited | Unlimited | Unlimited mint · 0.25% |

Flow: https://loyalspark.online/for-agents/subscribe → USDC on Base → auto-verify tx.

Mint fee is paid in **loyalty tokens**, not USDC.

## Related

- Web skill copy: https://loyalspark.online/.well-known/skills/15-payment-scenarios.md
- Full x402 detail: [x402-paid.md](./x402-paid.md)
- B20 spec: [b20-native-spec.md](./b20-native-spec.md)
