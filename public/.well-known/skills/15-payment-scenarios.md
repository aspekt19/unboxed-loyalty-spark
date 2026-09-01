# Skill: Payment Scenarios for Agents (x402 · MPP · subscriptions)

## Goal
Pick and execute the right payment corridor when an agent has to pay Loyal Spark — per call, per usage, or per month — following the Base "accept payments" lifecycle.

## Required Scope
None for paying; the underlying tool still needs its own scope after settlement.

## 0. Decide the corridor

| Situation | Use |
|-----------|-----|
| Agent already has an `lsk_` / `rwk_` key and a plan | **API key** — no payment per call |
| One-off call with a published fixed price | **x402 v2 `exact`** |
| Harness speaks Machine Payments Protocol / Tempo | **MPP gateway** |
| Recurring monthly quota and lower mint fee | **Agent plan subscription in USDC** |
| Variable amount, partial capture, refund, payout, or split required | **Not currently exposed by Loyal Spark gateways** — do not emulate it |

## 1. Payment lifecycle (Base model)

Base documents a broader lifecycle:

```
Request → Authorize → Capture (full or partial) → Verify → Refund / Payout / Split
                    ↘ Void
```

Loyal Spark currently exposes a narrower fixed-price request lifecycle:

```
Request → 402 challenge → Authorize exact amount → Verify → Settle → Retry request
```

| Phase | Loyal Spark behaviour |
|-------|----------------------|
| **Request** | Call a mapped gateway route with no payment → HTTP **402** + payment requirements and Bazaar metadata |
| **Authorize** | x402 client signs the exact advertised USDC amount on Base; MPP client obtains its Tempo payment credential |
| **Capture / Settle** | x402 gateway verifies and settles the exact amount through the configured facilitator before proxying; MPP returns a receipt after its charge succeeds |
| **Void** | Unknown route → **404**, no settlement. A failed settlement is a hard 402 and is not proxied upstream |
| **Verify** | Inspect the payment response and upstream JSON separately; a settled payment does not turn a failed business operation into success |
| **Refund / Payout / Split** | Not customer-callable operations in the current gateways. Subscription payment verification only activates the selected plan after a matching Base USDC transfer |

## 2. x402 `exact` — fixed-price call

```bash
# 1. discover
curl https://api.loyalspark.online/.well-known/x402

# 2. call (client SDK auto-pays on 402)
POST https://api.loyalspark.online/x402-gateway/mint
POST https://api.loyalspark.online/x402-gateway/mcp-tools/<tool_name>     # merchant, lsk_
POST https://api.loyalspark.online/x402-gateway/recipient-mcp-tools/<n>   # holder, rwk_
```

- Currency: **USDC on Base** `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`, CAIP-2 `eip155:8453`.
- Use `@x402/fetch` (or any x402 client) so the 402 → sign → retry loop is automatic.
- Prices per tool: `_shared/mcp-bazaar-tools.ts` (merchant) and `_shared/recipient-mcp-bazaar-tools.ts` (holder).

## 3. Variable-charge boundary

The public x402 gateway advertises `scheme: "exact"` for fixed route prices. It does **not** expose `scheme: "upto"`, metered capture, or a variable-price batch operation. Bulk work is represented by the route's published fixed price and normal request validation; never invent an `upto` payload or sign more than the server's exact requirement.

The same boundary applies to MPP: use the challenge and credential format returned by the MPP gateway, not x402 payload fields.

## 4. Spend policies (before signing anything)

Check these client-side, in this order, before every payment:

1. **Per-call cap** — reject if `maxAmountRequired` exceeds your ceiling.
2. **Per-session / daily budget** — accumulate settled amounts and stop at the budget.
3. **Asset + network allowlist** — only USDC on `eip155:8453` (or pathUSD on Tempo for MPP). Refuse anything else.
4. **Recipient allowlist** — the `payTo` address must match the one published at `https://api.loyalspark.online/.well-known/x402`.
5. **Idempotency** — retries after a network error must reuse the same authorization, never sign a fresh one.

## 5. MPP corridor

- Gateway: `https://api.loyalspark.online/mpp-gateway`
- Currency: **pathUSD on Tempo** (USDC also accepted).
- Manifest: `https://loyalspark.online/.well-known/mpp.json`
- Same 404-on-unknown-route and hard settlement gate as x402.

## 6. Subscriptions (best value for recurring agents)

Pay once a month in USDC on Base instead of per call:

| Plan | Price | API calls/mo | Agents | Mint fee |
|------|-------|--------------|--------|----------|
| Free | $0 | 200 | 1 | 1,000 tokens/mo · 1.25% |
| Pro | $49 USDC | 10,000 | 5 | 0.5% |
| Enterprise | $129 USDC | Unlimited | Unlimited | 0.25% |

Flow: `https://loyalspark.online/for-agents/subscribe` → pick plan → pay USDC on Base → the tx hash is verified automatically (polling); if verification lags, call the billing endpoint action `retry_verification`.

The **mint fee is paid in your own loyalty tokens** (an extra `mint()` to the platform fee wallet), not in USDC. Only subscriptions and x402 / MPP calls are USDC.

## 7. High-frequency usage

For many small charges, prefer a subscription and use the API key — the plan limits and mint commission are enforced server-side. If using pay-per-call, pay each published route price independently and reuse the same authorization only for a network retry of that same request.

## Success criteria
- Agent never signs a payment that violates its own spend policy.
- x402 requests use the server-advertised `exact` amount and asset.
- MPP requests use the MPP challenge/credential flow.
- Subscription is chosen once monthly volume and plan entitlements justify it.
- Agent does not claim `upto`, refund, payout, split, or partial capture support.

## Next skills
- [Getting Started](./00-getting-started.md)
- [B20 Native Spec](./14-b20-native-spec.md)
- [Endpoint Workflows](./13-endpoint-workflows.md)
