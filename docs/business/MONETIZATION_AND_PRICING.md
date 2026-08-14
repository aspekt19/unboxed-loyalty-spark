# Monetization & public pricing — Loyal Spark

This document is the **single source of truth** for public pricing: it reflects product docs, the marketing narrative, positioning vs regional benchmarks (e.g. UDS for Russia GTM), separate axes for **merchant SaaS** vs **AI agents**, pay-per-call (x402 / MPP), and explicit risks.

**Origin:** Product request to design platform monetization based on existing project documentation and the public product story.

**Implementation:** Agent plans are enforced in `agent_plans` + `verify-agent-plan-payment`. Merchant plans are enforced in `merchant_plans` + `merchant_plan_subscriptions` + the same Edge Function (see **Payment settlement** below).

---

## 1. Principles

1. **Two pricing axes (do not merge without explanation)**  
   - **Merchant** — portal access, humans, programs, CRM-light.  
   - **Agents** — API + MCP, `lsk_` keys, automation.  
   Pro agent pricing **above** merchant Starter is intentional (R&D / integration vs one operator seat).

2. **Cash revenue today comes from prepaid rails only** — agent/merchant **subscriptions in USDC** and **x402 / MPP per-request** payments. Both are collected *before* the service is delivered and cannot be skipped.

   The **mint fee %** is **not** a cash revenue line today: it is settled in the **merchant's own loyalty tokens**, and it is enforced **off-chain**. Treat it as protocol accounting and a future lever, not as ARR. See [§3.1](#31-what-the-mint-fee-actually-is) before putting it in any financial model.

3. **Globally** anchor on **SMB SaaS for on-chain loyalty**; UDS is a regional reference, not a feature checklist.

4. **Regulatory modes:** Where secondary trading of loyalty tokens is restricted, product routes (DEX / marketplace) may be off; **USD price list** stays one column — local acquiring is a **payment rail**, not a second price list.

---

## 2. Merchant SaaS (portal)

| Plan | USD / month | Role |
|------|-------------|------|
| **Starter** | **$39** | SMB entry |
| **Growth** | **$79** | Upsell for scale and depth. |
| **Scale** | **$149** | Corporate-style budgets and priority. |

**Annual billing (optional):** **15–20%** off vs 12× monthly — typical B2B SaaS.

**Honest positioning:** Do not claim parity with UDS on features you have not shipped (e.g. white-label mobile app). Compete on **on-chain programs + agents + transparency** at a **comparable loyalty/CRM-light** price point.

---

## 3. AI agents (API + MCP, `lsk_` keys)

| Plan | USD / month | API calls / month | Agents | Mint fee (% of mint amount) |
|------|-------------|-------------------|--------|-----------------------------|
| **Free** | **$0** | **200** | **1** | **1.25%** |
| **Pro** | **$49** | **10 000** | **5** | **0.50%** |
| **Enterprise** | **$129** | **Unlimited** | **Unlimited** | **0.25%** |

**Free @ 1.25%:** Slightly higher than 1% to offset a more generous free tier and reduce toxic micro-spam; monitor **COGS** if limits increase.

Subscriptions are paid in **USDC on Base** ($1 = 1 USDC) per current product flow.

**Enforcement note (2026-08):** Monthly **API call** quotas are enforced in Edge Functions (`consume_agent_monthly_quota`). The Free plan **1,000 tokens/mo** mint cap and Enterprise **unlimited agents** limit are stored in plan metadata and shown in the merchant UI but are **not** hard-blocked in `agent-api` today — treat them as product targets until server-side enforcement lands.

### 3.1 What the mint fee actually is

Be precise about this everywhere — public copy, decks, and investor material.

| Question | Answer today |
|---|---|
| What is charged? | A second `mint(address,uint256)` call on the **merchant's own loyalty token** |
| Paid in what? | **Loyalty tokens** (the merchant's points) sent to `PLATFORM_FEE_WALLET` — **not** USDC, not ETH, not fiat |
| Who enforces it? | The **API**, off-chain: `_shared/agent-fee-ledger.ts` records an obligation, verifies settlement from on-chain `Transfer`-from-zero logs, and blocks new mints after **5** unpaid obligations older than **60 min** |
| Does the token contract enforce it? | **No.** There is no `mintWithFee`. A merchant holding mint rights can mint directly on-chain and pay nothing |
| Can it be counted as revenue? | **No.** Loyalty points have no market price and the issuer can pause or expire the program |

Consequences to respect:

- **Never** present the mint fee as USD/USDC revenue or as the primary growth lever.
- **Never** claim it is "onchain-enforced", "automatic", "guaranteed", or "unavoidable". The accurate word is **accountability**.
- Contract-level enforcement (`mintWithFee` or an equivalent fee-on-mint hook) is a **roadmap item**; it needs a new factory or an upgrade path plus an audit, and the default **B20 factory is not ours**.
- Column `agent_usage.fees_collected_usdc` stores **token units**, not USDC — legacy name, do not read it as dollars.

---

## 4. Pay-per-call (x402 / MPP)

Public **corridor** (tune for gas + facilitator):

| Type | USD range | Messaging |
|------|-----------|-----------|
| Read | **~$0.001–0.005** | “**From ~$0.002** per read” |
| Write | **~$0.005–0.05** | Publish upper bound in API docs when stable |

### 4.1 Recipient agents (`rwk_`) — same corridor

Buyer-side agents pay for paid routes when using **`mpp-gateway`** (MPP) or **`x402-gateway`** (USDC x402). Direct **`rwk_`** calls use the same free-tier **200 calls/mo** as `lsk_` (`agent_usage`).

**REST** (`recipient-api/…` after the gateway prefix) — source: `supabase/functions/_shared/recipient-paid-routes.ts`:

| Method | Route suffix | USD |
|--------|----------------|-----|
| GET | `recipient-api/me` | **0** |
| GET | `recipient-api/balances`, `balance`, `rewards`, `vouchers`, `offers` | **0.001** |
| POST | `recipient-api/register` | **0** |
| POST | `recipient-api/prepare-transfer` | **0.005** (aligned with merchant `transfer`) |
| POST | `recipient-api/redeem-reward`, `offers`, `accept-offer` | **0.01** |
| POST | `recipient-api/cancel-offer` | **0.005** |

**MCP** (x402 only; resource `recipient-mcp-tools/<tool>`) — source: `supabase/functions/_shared/recipient-mcp-bazaar-tools.ts`.  
Discovery (Coinbase **x402 Bazaar**): the gateway builds HTTP **402** `accepts` with `extensions.bazaar` and MCP-shaped `outputSchema` via `_shared/x402-bazaar-accept.ts` (same pattern as merchant `mcp-tools/*`).

| Tool | USD | Notes |
|------|-----|--------|
| `prepare_loyalty_token_transfer` | **0.005** | Same band as transfer calldata |
| `list_p2p_offers` | **0.001** | Aligned with merchant GET `/offers` on MPP |
| `cancel_p2p_offer` | **0.005** | Aligned with merchant cancel |
| All other listed recipient tools | **0.01** | Same default as merchant MCP Bazaar tools |

---

## 5. Payment settlement (both merchants & agents)

- **Wallet:** `payment_settings.subscription_wallet_address` — **one** treasury address for **USDC on Base**.  
- **Verification:** Edge Function `verify-agent-plan-payment`  
  - `action: "get_payment_info"` + optional `product: "agent" | "merchant"` (default **`agent`**).  
  - `action: "verify_payment"` + `product`, `plan_slug`, `owner_address`, `transaction_hash`.  
- **On-chain check:** ERC-20 **Transfer** logs for USDC to the subscription wallet (BaseScan API when `BASESCAN_API_KEY` is set).

Merchant and agent plans **share the same payout address**; they differ by **plan table** and **subscription row** (`agent_plan_subscriptions` vs `merchant_plan_subscriptions`).

---

## 6. “Two bills” narrative (site copy)

Use one schema everywhere:

- **Merchant bill** = portal + people + programs.  
- **Agent bill** = automation + integrations + API limits + lower mint %.

Without this split, conversion drops.

When the agent bill is described, the **paid** part is the subscription and per-request calls; the lower mint % is a **benefit of the tier**, not a second invoice.

---

## 7. Risks & caveats

| Risk | Mitigation |
|------|------------|
| Drift between marketing and DB fees/limits | This doc + migrations; `agent_plans` / `merchant_plans` as truth. |
| COGS on Free @ **200** calls | Monitor Edge/DB load; tighten fair-use if needed. |
| Expectation of full UDS parity | Clear roadmap-only claims. |
| Russia: friction paying USDC | Separate acquiring track **without** publishing a second USD ladder. |
| **Mint fee read as cash revenue** | §3.1 wording is mandatory in decks and site copy; models rely on subscriptions + x402 only. |
| **Mint fee bypassed by direct on-chain mint** | Accepted today — the fee is in points, so the loss is not cash. Off-chain ledger blocks repeat offenders; contract-level enforcement is roadmap. |

---

## 8. Product economics (loyalty model)

Default obligation class for programs: **discount claim** (nominal discount, caps, redemption). Secondary markets and **$LOYAL** are strategic layers; `marketplace/` / `roundup/` modules may stay frozen until launch — **pricing above is independent** of those modules.

---

## Related

- [ACTION_PLAN_MONETIZATION.md](./ACTION_PLAN_MONETIZATION.md) — sync checklist for code, DB, and production.
