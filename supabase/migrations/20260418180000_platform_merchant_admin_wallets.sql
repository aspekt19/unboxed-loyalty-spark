-- 1) Platform admin wallets — unlimited merchant SaaS (use is_unrestricted_merchant in future enforcement)
-- 2) Grandfathering: Growth for 90 days for existing merchant_profiles (excludes admins)
--
-- BEFORE applying: uncomment the INSERT block below and set your two real 0x addresses.
-- If you skip this, admins will receive Growth like everyone else until you fix rows manually.

CREATE TABLE IF NOT EXISTS public.platform_merchant_admin_wallets (
  wallet_address text PRIMARY KEY,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wallet_address_lower_hex CHECK (wallet_address ~* '^0x[a-f0-9]{40}$')
);

COMMENT ON TABLE public.platform_merchant_admin_wallets IS
  'Operator wallets: is_unrestricted_merchant() = true; no merchant tier limits.';

ALTER TABLE public.platform_merchant_admin_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No public access merchant admin wallets"
  ON public.platform_merchant_admin_wallets FOR ALL
  USING (false);

CREATE POLICY "Service role full merchant admin wallets"
  ON public.platform_merchant_admin_wallets FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.is_unrestricted_merchant(p_wallet text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.platform_merchant_admin_wallets a
    WHERE lower(a.wallet_address) = lower(trim(p_wallet))
  );
$$;

REVOKE ALL ON FUNCTION public.is_unrestricted_merchant(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_unrestricted_merchant(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_unrestricted_merchant(text) TO service_role;

COMMENT ON FUNCTION public.is_unrestricted_merchant(text) IS
  'True for platform admin merchant wallets — unlimited merchant SaaS.';

-- Uncomment and set your two admin wallets before migration push:
-- INSERT INTO public.platform_merchant_admin_wallets (wallet_address, note) VALUES
--   ('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'platform admin 1'),
--   ('0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', 'platform admin 2')
-- ON CONFLICT (wallet_address) DO NOTHING;

-- Grandfather: Growth 90d for all merchant_profiles except unrestricted + those with active sub already
DO $$
DECLARE
  v_growth_id uuid;
  v_now timestamptz := now();
  v_expires timestamptz := v_now + interval '90 days';
  v_use_eligibility_cutoff boolean := false;
  v_eligibility_cutoff timestamptz := timestamptz '2099-01-01 00:00:00+00';
BEGIN
  SELECT id INTO v_growth_id FROM public.merchant_plans WHERE slug = 'growth' AND is_active = true LIMIT 1;
  IF v_growth_id IS NULL THEN
    RAISE EXCEPTION 'merchant_plans.slug=growth missing; apply merchant_plans migration first';
  END IF;

  INSERT INTO public.merchant_plan_subscriptions (
    owner_address,
    plan_id,
    status,
    amount_usdc,
    transaction_hash,
    paid_at,
    expires_at
  )
  SELECT
    lower(trim(mp.merchant_address)),
    v_growth_id,
    'active',
    0,
    'grandfather_growth_90d',
    v_now,
    v_expires
  FROM public.merchant_profiles mp
  WHERE NOT public.is_unrestricted_merchant(mp.merchant_address)
    AND (NOT v_use_eligibility_cutoff OR mp.created_at < v_eligibility_cutoff)
    AND NOT EXISTS (
      SELECT 1
      FROM public.merchant_plan_subscriptions existing
      WHERE lower(existing.owner_address) = lower(trim(mp.merchant_address))
        AND existing.status = 'active'
    );

  UPDATE public.merchant_profiles mp
  SET merchant_plan_id = v_growth_id
  WHERE NOT public.is_unrestricted_merchant(mp.merchant_address)
    AND lower(trim(mp.merchant_address)) IN (
      SELECT lower(owner_address)
      FROM public.merchant_plan_subscriptions
      WHERE plan_id = v_growth_id
        AND transaction_hash = 'grandfather_growth_90d'
        AND paid_at >= v_now - interval '2 minutes'
    );
END $$;
