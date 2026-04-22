-- 1) Cleanup duplicate emails/phones in customer_profiles
-- Keep the value on the primary wallet (per identity_links), else on the oldest profile.
WITH ranked_email AS (
  SELECT cp.wallet_address,
         lower(cp.email) AS email_norm,
         ROW_NUMBER() OVER (
           PARTITION BY lower(cp.email)
           ORDER BY
             COALESCE((SELECT il.is_primary FROM public.identity_links il
                        WHERE lower(il.wallet_address) = lower(cp.wallet_address)
                        ORDER BY il.is_primary DESC LIMIT 1), false) DESC,
             cp.created_at ASC
         ) AS rn
  FROM public.customer_profiles cp
  WHERE cp.email IS NOT NULL AND cp.email <> ''
)
UPDATE public.customer_profiles cp
SET email = NULL, updated_at = now()
FROM ranked_email re
WHERE cp.wallet_address = re.wallet_address
  AND re.rn > 1;

WITH ranked_phone AS (
  SELECT cp.wallet_address,
         cp.phone,
         ROW_NUMBER() OVER (
           PARTITION BY cp.phone
           ORDER BY
             COALESCE((SELECT il.is_primary FROM public.identity_links il
                        WHERE lower(il.wallet_address) = lower(cp.wallet_address)
                        ORDER BY il.is_primary DESC LIMIT 1), false) DESC,
             cp.created_at ASC
         ) AS rn
  FROM public.customer_profiles cp
  WHERE cp.phone IS NOT NULL AND cp.phone <> ''
)
UPDATE public.customer_profiles cp
SET phone = NULL, updated_at = now()
FROM ranked_phone rp
WHERE cp.wallet_address = rp.wallet_address
  AND rp.rn > 1;

-- 2) Cleanup duplicates in profiles (Privy/auth profile)
WITH ranked_p_email AS (
  SELECT p.user_id,
         lower(p.email) AS email_norm,
         ROW_NUMBER() OVER (
           PARTITION BY lower(p.email)
           ORDER BY
             COALESCE((SELECT il.is_primary FROM public.identity_links il
                        WHERE lower(il.wallet_address) = lower(p.wallet_address)
                        ORDER BY il.is_primary DESC LIMIT 1), false) DESC,
             p.created_at ASC
         ) AS rn
  FROM public.profiles p
  WHERE p.email IS NOT NULL AND p.email <> ''
)
UPDATE public.profiles p
SET email = NULL, updated_at = now()
FROM ranked_p_email re
WHERE p.user_id = re.user_id
  AND re.rn > 1;

WITH ranked_p_phone AS (
  SELECT p.user_id,
         p.phone,
         ROW_NUMBER() OVER (
           PARTITION BY p.phone
           ORDER BY
             COALESCE((SELECT il.is_primary FROM public.identity_links il
                        WHERE lower(il.wallet_address) = lower(p.wallet_address)
                        ORDER BY il.is_primary DESC LIMIT 1), false) DESC,
             p.created_at ASC
         ) AS rn
  FROM public.profiles p
  WHERE p.phone IS NOT NULL AND p.phone <> ''
)
UPDATE public.profiles p
SET phone = NULL, updated_at = now()
FROM ranked_p_phone rp
WHERE p.user_id = rp.user_id
  AND rp.rn > 1;

-- 3) Unique partial indexes (case-insensitive email, exact phone)
CREATE UNIQUE INDEX IF NOT EXISTS customer_profiles_email_unique_idx
  ON public.customer_profiles (lower(email))
  WHERE email IS NOT NULL AND email <> '';

CREATE UNIQUE INDEX IF NOT EXISTS customer_profiles_phone_unique_idx
  ON public.customer_profiles (phone)
  WHERE phone IS NOT NULL AND phone <> '';

CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_unique_idx
  ON public.profiles (lower(email))
  WHERE email IS NOT NULL AND email <> '' AND email NOT LIKE '%@privy.auth';

CREATE UNIQUE INDEX IF NOT EXISTS profiles_phone_unique_idx
  ON public.profiles (phone)
  WHERE phone IS NOT NULL AND phone <> '';