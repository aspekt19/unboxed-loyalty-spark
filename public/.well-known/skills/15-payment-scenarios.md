# Skill: Payment Scenarios for Agents (x402 · MPP · subscriptions)

## Goal
Pick and execute the right payment corridor when an agent has to pay Loyal Spark — per call, per usage, or per month — following the Base "accept payments" lifecycle.

## Required Scope
None for paying; the underlying tool still needs its own scope after settlement.

## 0. Decide the corridor

| Situation | Use |
|-----------|-----|
| Agent already has an `lsk_` / `rwk_` key and a plan | **API key** — no payment per call |
| One-off call, fixed price, no account | **x402 `exact`** |
| Usage-based call where cost is known only after execution (bulk mint, export, analytics window) | **x402 `upto`** |
| Harness speaks Machine Payments Protocol / Tempo | **MPP gateway** |
| Recurring monthly quota (10k calls, lower mint fee) | **Agent plan subscription in USDC** |

## 1. Payment lifecycle (Base model)

```
Request → Authorize → Capture (full or partial) → Verify → Refund / Payout / Split
                    ↘ Void
```

How it maps to Loyal Spark:

| Phase | Loyal Spark behaviour |
|-------|----------------------|
| **Request** | Call the gateway route with no payment → HTTP **402** + `extensions.bazaar` metadata (price, asset, network, schema) |
| **Authorize** | Client signs an EIP-3009 `exact` (or `upto` max) authorization for USDC on Base and retries with `X-PAYMENT` |
| **Capture** | Gateway settles through the Coinbase CDP facilitator. `upto` settles the **measured** amount, never more than the authorized max |
| **Void** | Unknown route → **404**, no settlement. Upstream failure before execution → authorization is not captured |
| **Verify** | Settlement is a hard gate: if it fails the gateway returns 402 with `X-Payment-Error: Settlement failed` and does **not** forward the upstream response |
| **Refund / Payout** | Handled off-protocol by Loyal Spark support; agent plan overpayments are reconciled by `verify-agent-plan-payment` |

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

## 3. x402 `upto` — usage-based call

Use when the final amount depends on the work done (e.g. minting to N recipients, exporting a large customer segment, analytics over a wide window).

1. Authorize a **maximum** you accept (`scheme: "upto"`, `maxAmountRequired`).
2. The gateway executes, measures the units consumed, and settles **only the measured amount**.
3. The unsettled remainder of the authorization expires — no void call needed.

> Agent rule: always set an `upto` ceiling from your own spend policy, never from the price the server suggests.

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
| Free | $0 | 200 | 1 | 1.25% |
| Pro | $49 USDC | 10,000 | 5 | 0.5% |
| Enterprise | $129 USDC | Unlimited | Unlimited | 0.25% |

Flow: `https://loyalspark.online/for-agents/subscribe` → pick plan → pay USDC on Base → the tx hash is verified automatically (polling); if verification lags, call the billing endpoint action `retry_verification`.

The **mint fee is paid in your own loyalty tokens** (an extra `mint()` to the platform fee wallet), not in USDC. Only subscriptions and x402 / MPP calls are USDC.

## 7. High-frequency batching

For many small charges, prefer batching over one payment per call:
- Subscribe (§6) and use the API key — cheapest for >200 calls/month.
- Or accumulate work and pay once with a single `upto` authorization covering the batch.

## Success criteria
- Agent never signs a payment that violates its own spend policy.
- `upto` is used for variable-cost calls instead of over-paying with `exact`.
- Subscription is chosen once monthly volume beats per-call pricing.

## Next skills
- [Getting Started](./00-getting-started.md)
- [B20 Native Spec](./14-b20-native-spec.md)
- [Endpoint Workflows](./13-endpoint-workflows.md)
