-- Drop legacy too-strict index (only one primary across ALL types per user)
DROP INDEX IF EXISTS public.identity_links_one_primary_per_user;

-- Migrate emails from profiles
INSERT INTO public.identity_links (user_id, link_type, value, value_normalized, verified_via, is_primary)
SELECT
  p.user_id,
  'email',
  p.email,
  lower(trim(p.email)),
  'legacy_migration',
  true
FROM public.profiles p
WHERE p.email IS NOT NULL
  AND trim(p.email) <> ''
  AND p.user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.identity_links il
    WHERE il.link_type = 'email'
      AND il.value_normalized = lower(trim(p.email))
  )
ON CONFLICT (link_type, value_normalized) DO NOTHING;

-- Migrate emails from customer_profiles
INSERT INTO public.identity_links (user_id, link_type, value, value_normalized, verified_via, is_primary)
SELECT
  pr.user_id,
  'email',
  cp.email,
  lower(trim(cp.email)),
  'legacy_migration',
  NOT EXISTS (
    SELECT 1 FROM public.identity_links il2
    WHERE il2.user_id = pr.user_id AND il2.link_type = 'email' AND il2.is_primary = true
  )
FROM public.customer_profiles cp
JOIN public.profiles pr ON lower(pr.wallet_address) = lower(cp.wallet_address)
WHERE cp.email IS NOT NULL
  AND trim(cp.email) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.identity_links il
    WHERE il.link_type = 'email'
      AND il.value_normalized = lower(trim(cp.email))
  )
ON CONFLICT (link_type, value_normalized) DO NOTHING;