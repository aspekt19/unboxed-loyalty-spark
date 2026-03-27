-- Recreate view with security_invoker so underlying table RLS applies
DROP VIEW IF EXISTS public.merchant_analytics;

CREATE VIEW public.merchant_analytics
WITH (security_invoker = on) AS
SELECT lp.merchant_address,
    lp.token_address,
    lp.name AS program_name,
    lp.symbol AS token_symbol,
    count(DISTINCT v.customer_address) AS total_customers,
    count(DISTINCT
        CASE
            WHEN (v.activated_at > (now() - '30 days'::interval)) THEN v.customer_address
            ELSE NULL::text
        END) AS active_customers_30d,
    count(DISTINCT
        CASE
            WHEN (v.activated_at > (now() - '7 days'::interval)) THEN v.customer_address
            ELSE NULL::text
        END) AS active_customers_7d,
    count(v.id) AS total_vouchers_issued,
    count(
        CASE
            WHEN (v.status = 'used'::text) THEN 1
            ELSE NULL::integer
        END) AS vouchers_redeemed,
    sum(v.cost) AS total_tokens_spent,
    avg(v.cost) AS avg_voucher_cost,
    count(
        CASE
            WHEN (v.activated_at > (now() - '30 days'::interval)) THEN 1
            ELSE NULL::integer
        END) AS vouchers_last_30d,
    lp.created_at AS program_created_at
   FROM loyalty_programs lp
     LEFT JOIN vouchers v ON v.token_address = lp.token_address
  GROUP BY lp.merchant_address, lp.token_address, lp.name, lp.symbol, lp.created_at;