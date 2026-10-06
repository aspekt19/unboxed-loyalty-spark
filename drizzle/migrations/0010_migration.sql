ALTER TABLE public.merchant_profiles
  ADD COLUMN IF NOT EXISTS merchant_type text NOT NULL DEFAULT 'in_store';

ALTER TABLE public.merchant_profiles
  DROP CONSTRAINT IF EXISTS merchant_profiles_merchant_type_check;
ALTER TABLE public.merchant_profiles
  ADD CONSTRAINT merchant_profiles_merchant_type_check
  CHECK (merchant_type IN ('in_store','online','program_only','agent'));

-- Internal: per-merchant Discover listing criteria
CREATE OR REPLACE FUNCTION public.merchant_discover_criteria(p_merchant text)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'has_paid_plan', (
      public.is_unrestricted_merchant(p_merchant) OR EXISTS (
        SELECT 1 FROM public.merchant_plan_subscriptions s
        WHERE lower(s.owner_address) = lower(p_merchant)
          AND s.status = 'active' AND s.is_trial = false
          AND (s.expires_at IS NULL OR s.expires_at > now())
      )
    ),
    'has_active_program', EXISTS (
      SELECT 1 FROM public.loyalty_programs lp
      WHERE lower(lp.merchant_address) = lower(p_merchant)
        AND lp.status IN ('active','expiring_soon')
        AND lp.expiration_date > now()
    ),
    'is_banned', public.is_wallet_banned(p_merchant),
    'is_agent', (
      EXISTS (SELECT 1 FROM public.merchant_profiles mp
              WHERE lower(mp.merchant_address) = lower(p_merchant) AND mp.merchant_type = 'agent')
      OR EXISTS (SELECT 1 FROM public.agent_registry a
                 WHERE lower(a.agent_wallet_address) = lower(p_merchant))
      OR EXISTS (SELECT 1 FROM public.agent_wallets w
                 WHERE lower(w.wallet_address) = lower(p_merchant))
    )
  );
$$;
REVOKE ALL ON FUNCTION public.merchant_discover_criteria(text) FROM PUBLIC, anon, authenticated;

-- Public: addresses of merchants listed in the human Discover catalogue
CREATE OR REPLACE FUNCTION public.get_discover_merchant_addresses()
RETURNS SETOF text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT mp.merchant_address
  FROM public.merchant_profiles mp
  CROSS JOIN LATERAL public.merchant_discover_criteria(mp.merchant_address) c
  WHERE mp.merchant_type <> 'agent'
    AND coalesce(btrim(mp.business_name),'') <> ''
    AND coalesce(btrim(mp.description),'') <> ''
    AND coalesce(btrim(mp.logo_url),'') <> ''
    AND coalesce(btrim(mp.location),'') <> ''
    AND (c->>'has_paid_plan')::boolean
    AND (c->>'has_active_program')::boolean
    AND NOT (c->>'is_banned')::boolean
    AND NOT (c->>'is_agent')::boolean;
$$;
GRANT EXECUTE ON FUNCTION public.get_discover_merchant_addresses() TO anon, authenticated;

-- Owner: own listing criteria (for the dashboard indicator)
CREATE OR REPLACE FUNCTION public.get_my_discover_status(p_merchant text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_current_user_linked_wallet(p_merchant) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;
  RETURN public.merchant_discover_criteria(p_merchant);
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_my_discover_status(text) TO authenticated;