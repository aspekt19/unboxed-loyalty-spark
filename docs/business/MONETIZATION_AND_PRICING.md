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

2. **Primary scale lever for agents** — **mint fee %** on chain volume, not subscription alone.

3. **UDS benchmark (Russia SMB)** — competitor starter ~**4 000 ₽/mo** at ~**95–100 ₽/$** maps to ~**$39–49/mo** for **merchant** Starter; show **₽ equivalent** next to USD on localized landing pages.

4. **Globally** anchor on **SMB SaaS for on-chain loyalty**; UDS is a regional reference, not a feature checklist.

5. **Regulatory modes:** Where secondary trading of loyalty tokens is restricted, product routes (DEX / marketplace) may be off; **USD price list** stays one column — local acquiring is a **payment rail**, not a second price list.

---

## 2. Merchant SaaS (portal)

| Plan | USD / month | Role |
|------|-------------|------|
| **Starter** | **$39** | SMB entry; competitive floor vs ~4 000 ₽ (corridor **$39–49** acceptable for tests). |
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

---

## 4. Pay-per-call (x402 / MPP)

Public **corridor** (tune for gas + facilitator):

| Type | USD range | Messaging |
|------|-----------|-----------|
| Read | **~$0.001–0.005** | “**From ~$0.002** per read” |
| Write | **~$0.005–0.05** | Publish upper bound in API docs when stable |

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

---

## 7. Risks & caveats

| Risk | Mitigation |
|------|------------|
| Drift between marketing and DB fees/limits | This doc + migrations; `agent_plans` / `merchant_plans` as truth. |
| COGS on Free @ **200** calls | Monitor Edge/DB load; tighten fair-use if needed. |
| Expectation of full UDS parity | Clear roadmap-only claims. |
| Russia: friction paying USDC | Separate acquiring track **without** publishing a second USD ladder. |

---

## 8. Product economics (loyalty model)

Default obligation class for programs: **discount claim** (nominal discount, caps, redemption). Secondary markets and **$LOYAL** are strategic layers; `marketplace/` / `roundup/` modules may stay frozen until launch — **pricing above is independent** of those modules.

---

## Related

- [ACTION_PLAN_MONETIZATION.md](./ACTION_PLAN_MONETIZATION.md) — sync checklist for code, DB, and production.
