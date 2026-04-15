# Grandfathering & platform admin wallets

## Platform admins (no merchant SaaS limits)

Table: **`platform_merchant_admin_wallets`**

- Enforcement (when implemented) must **first** call **`public.is_unrestricted_merchant(wallet)`**; if `true`, **do not apply** program/team/CRM limits.
- RLS: no public read — only `service_role` and `SECURITY DEFINER` functions see rows.

### Before you run the migration

In **`20260418180000_platform_merchant_admin_wallets.sql`**, **uncomment** the `INSERT` block and set your **two real** Base wallet addresses.  
If you leave it commented, the table stays empty: **your admin wallets will be grandfathered as Growth** like everyone else (fix later by inserting admins and deleting bad subscription rows if needed).

## Grandfathering (Growth 90 days)

Same migration file runs a `DO` block that:

- For every **`merchant_profiles`** row, **except**:
  - addresses in `platform_merchant_admin_wallets` (after your INSERT), and
  - merchants who already have an **`active`** `merchant_plan_subscriptions` row,
- inserts **Growth**, **90 days**, `amount_usdc = 0`, `transaction_hash = 'grandfather_growth_90d'`.
- Sets **`merchant_profiles.merchant_plan_id`** to Growth for those merchants.

After **90 days**, set `status` / expiry via product logic or cron; until enforcement exists, “Free until paid” is policy only.

### Optional: only merchants registered before date X

In the `DO` block in the migration, set:

- `v_use_eligibility_cutoff := true`
- `v_eligibility_cutoff := 'YYYY-MM-DD …'` (UTC)

Then only `created_at < v_eligibility_cutoff` are grandfathered.

## SQL helper

- **`public.is_unrestricted_merchant(text)`** — use from triggers, RLS, and `supabase.rpc` from the app.
