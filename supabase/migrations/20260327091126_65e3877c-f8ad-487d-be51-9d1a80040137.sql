DROP VIEW IF EXISTS public.merchant_customer_view;

CREATE VIEW public.merchant_customer_view
WITH (security_invoker = on) AS
SELECT cp.id,
    cp.wallet_address,
    mask_email(cp.email) AS email,
    mask_phone(cp.phone) AS phone,
    CASE
        WHEN cp.first_name IS NOT NULL THEN left(cp.first_name, 1) || '***'
        ELSE NULL::text
    END AS first_name,
    NULL::text AS last_name,
    cp.rfm_score,
    cp.total_purchases,
    cp.total_spent,
    cp.last_purchase_date,
    cp.created_at,
    cp.updated_at,
    v.merchant_address
FROM customer_profiles cp
JOIN (
    SELECT DISTINCT vouchers.customer_address, vouchers.merchant_address
    FROM vouchers
) v ON cp.wallet_address = v.customer_address;