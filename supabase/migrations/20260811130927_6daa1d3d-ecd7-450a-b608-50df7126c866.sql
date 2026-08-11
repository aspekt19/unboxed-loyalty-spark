-- Helper: is the profile role unchanged (or admin/service)?
CREATE OR REPLACE FUNCTION public.profile_role_change_allowed(p_user_id uuid, p_role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin')
    OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = p_user_id)
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = p_user_id
        AND COALESCE(role, '') IS NOT DISTINCT FROM COALESCE(p_role, '')
    );
$$;

-- Helper: merchant plan change allowed (unchanged, free plan, or paid subscription exists)
CREATE OR REPLACE FUNCTION public.merchant_plan_change_allowed(p_merchant_address text, p_plan_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.merchant_profiles mp
      WHERE lower(mp.merchant_address) = lower(p_merchant_address)
        AND mp.merchant_plan_id IS NOT DISTINCT FROM p_plan_id
    )
    OR p_plan_id IS NULL
    OR COALESCE((SELECT price_usdc_monthly FROM public.merchant_plans WHERE id = p_plan_id), 0) <= 0
    OR EXISTS (
      SELECT 1 FROM public.merchant_plan_subscriptions s
      WHERE lower(s.owner_address) = lower(p_merchant_address)
        AND s.plan_id = p_plan_id
        AND s.status IN ('trialing','active')
    );
$$;

-- Helper: agent plan change allowed
CREATE OR REPLACE FUNCTION public.agent_plan_change_allowed(p_agent_id uuid, p_owner_address text, p_plan_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.agent_registry a
      WHERE a.id = p_agent_id
        AND a.plan_id IS NOT DISTINCT FROM p_plan_id
    )
    OR p_plan_id IS NULL
    OR COALESCE((SELECT price_usdc_monthly FROM public.agent_plans WHERE id = p_plan_id), 0) <= 0
    OR EXISTS (
      SELECT 1 FROM public.agent_plan_subscriptions s
      WHERE lower(s.owner_address) = lower(COALESCE(p_owner_address, ''))
        AND s.plan_id = p_plan_id
        AND s.status IN ('trialing','active')
    );
$$;

-- profiles: block self role escalation on UPDATE
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND public.profile_role_change_allowed(user_id, role)
  AND (
    public.has_role(auth.uid(), 'admin')
    OR (
      COALESCE(is_banned, false) = false
      AND banned_at IS NULL
      AND banned_by IS NULL
      AND ban_reason IS NULL
    )
  )
);

-- merchant_profiles: block plan self upgrade
DROP POLICY IF EXISTS "Merchants can update own profile" ON public.merchant_profiles;
CREATE POLICY "Merchants can update own profile"
ON public.merchant_profiles
FOR UPDATE
TO authenticated
USING (
  lower(merchant_address) = lower(COALESCE((
    SELECT p.wallet_address FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1
  ), ''))
)
WITH CHECK (
  lower(merchant_address) = lower(COALESCE((
    SELECT p.wallet_address FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1
  ), ''))
  AND public.merchant_plan_change_allowed(merchant_address, merchant_plan_id)
);

-- agent_registry: block plan self upgrade
DROP POLICY IF EXISTS "Owners can manage own agents" ON public.agent_registry;
CREATE POLICY "Owners can manage own agents"
ON public.agent_registry
FOR ALL
TO authenticated
USING (
  lower(owner_address) = lower(COALESCE((
    SELECT p.wallet_address FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1
  ), ''))
)
WITH CHECK (
  lower(owner_address) = lower(COALESCE((
    SELECT p.wallet_address FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1
  ), ''))
  AND public.agent_plan_change_allowed(id, owner_address, plan_id)
);
