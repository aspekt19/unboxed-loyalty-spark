# Action plan — monetization & published pricing

Canonical policy: **[MONETIZATION_AND_PRICING.md](./MONETIZATION_AND_PRICING.md)**.

---

## P0 — Repository (docs + code)

1. **Canonical doc** — `docs/business/MONETIZATION_AND_PRICING.md` (English).
2. **This checklist** — `docs/business/ACTION_PLAN_MONETIZATION.md`.
3. **Index** — `docs/business/README.md`, links from `docs/README.md` and `AGENTS.md`.
4. **Public surfaces** — README, Guide, `llms.txt` / `llms-full.txt`, skills index, API docs components, press kit, integration notes, `.cursorrules` — aligned with agent + merchant tables.
5. **Database** — `merchant_plans`, `merchant_plan_subscriptions`, `merchant_profiles.merchant_plan_id`; `verify-agent-plan-payment` supports `product: "merchant"`.
6. **UI** — Merchant portal **Billing** tab (`MerchantBillingDashboard`) using the same USDC flow as `AgentBillingDashboard`.

---

## P1 — Production

1. **Apply migrations** (staging → production): agent pricing v2 + merchant plans migration.
2. **Configure** `payment_settings.subscription_wallet_address` if empty (same wallet for merchants and agents).
3. **`BASESCAN_API_KEY`** — enables automatic USDC transfer verification; without it, subscriptions may stay `pending_verification` until admin confirm.
4. **Existing Pro/Enterprise agent subscribers** at old prices — grandfathering or notice per Legal / ToS.

---

## P2 — Go-to-market

1. Dedicated **Pricing** page with **two columns** (Merchant vs Agents).
2. **Russia:** optional “from ~X ₽/mo” next to USD on Starter (refresh rate periodically).
3. **Monitor** COGS after Free tier **200** calls / month.

---

## Consistency checklist

| Source | Agent tiers | Merchant SaaS |
|--------|-------------|---------------|
| `docs/business/MONETIZATION_AND_PRICING.md` | ✓ canonical | ✓ canonical |
| `README.md` | ✓ | ✓ short + link |
| `agent_plans` / `merchant_plans` DB | ✓ after migrations | ✓ after migrations |
| Site `/guide`, llms | ✓ | as UI ships |

---

## Ownership (recommended)

| Area | Owner |
|------|--------|
| USD amounts, %, API limits | Product + Finance |
| Copy / publication | Product |
| Migrations & Edge Functions | Engineering |
| Legacy subscriber changes | Legal / Ops |
