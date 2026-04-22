
-- Add ban columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_banned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS banned_at timestamptz,
  ADD COLUMN IF NOT EXISTS banned_by text,
  ADD COLUMN IF NOT EXISTS ban_reason text;

CREATE INDEX IF NOT EXISTS idx_profiles_is_banned ON public.profiles(is_banned) WHERE is_banned = true;

-- Moderation audit log
CREATE TABLE IF NOT EXISTS public.user_moderation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_wallet_address text NOT NULL,
  target_role text NOT NULL CHECK (target_role IN ('merchant','customer')),
  action text NOT NULL CHECK (action IN ('ban','unban','delete')),
  reason text,
  performed_by_wallet text NOT NULL,
  performed_by_user_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_moderation_log_target ON public.user_moderation_log(lower(target_wallet_address));
CREATE INDEX IF NOT EXISTS idx_user_moderation_log_created ON public.user_moderation_log(created_at DESC);

ALTER TABLE public.user_moderation_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view moderation log"
  ON public.user_moderation_log FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Service role full access moderation log"
  ON public.user_moderation_log FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- Helper function: check if a wallet is banned (used in RLS)
CREATE OR REPLACE FUNCTION public.is_wallet_banned(p_wallet text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT is_banned FROM public.profiles
    WHERE lower(wallet_address) = lower(p_wallet)
    LIMIT 1
  ), false);
$$;

-- Helper: is current user banned
CREATE OR REPLACE FUNCTION public.is_current_user_banned()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT is_banned FROM public.profiles
    WHERE user_id = auth.uid()
    LIMIT 1
  ), false);
$$;

-- Admin RPCs
CREATE OR REPLACE FUNCTION public.admin_ban_user(
  p_wallet_address text,
  p_target_role text,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_wallet text;
  v_target_norm text := lower(trim(p_wallet_address));
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;

  IF v_target_norm IS NULL OR v_target_norm = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_wallet');
  END IF;

  IF p_target_role NOT IN ('merchant','customer') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_role');
  END IF;

  SELECT wallet_address INTO v_admin_wallet
    FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;

  -- Prevent banning other admins
  IF EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.profiles p ON p.user_id = ur.user_id
    WHERE lower(p.wallet_address) = v_target_norm AND ur.role = 'admin'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'cannot_ban_admin');
  END IF;

  UPDATE public.profiles
    SET is_banned = true,
        banned_at = now(),
        banned_by = v_admin_wallet,
        ban_reason = p_reason
    WHERE lower(wallet_address) = v_target_norm;

  INSERT INTO public.user_moderation_log
    (target_wallet_address, target_role, action, reason, performed_by_wallet, performed_by_user_id)
  VALUES (v_target_norm, p_target_role, 'ban', p_reason, COALESCE(v_admin_wallet,''), auth.uid());

  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_unban_user(
  p_wallet_address text,
  p_target_role text,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_wallet text;
  v_target_norm text := lower(trim(p_wallet_address));
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;

  IF p_target_role NOT IN ('merchant','customer') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_role');
  END IF;

  SELECT wallet_address INTO v_admin_wallet
    FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;

  UPDATE public.profiles
    SET is_banned = false,
        banned_at = NULL,
        banned_by = NULL,
        ban_reason = NULL
    WHERE lower(wallet_address) = v_target_norm;

  INSERT INTO public.user_moderation_log
    (target_wallet_address, target_role, action, reason, performed_by_wallet, performed_by_user_id)
  VALUES (v_target_norm, p_target_role, 'unban', p_reason, COALESCE(v_admin_wallet,''), auth.uid());

  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_user(
  p_wallet_address text,
  p_target_role text,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_wallet text;
  v_target_norm text := lower(trim(p_wallet_address));
  v_target_user_id uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;

  IF p_target_role NOT IN ('merchant','customer') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_role');
  END IF;

  -- Prevent deleting admins
  IF EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.profiles p ON p.user_id = ur.user_id
    WHERE lower(p.wallet_address) = v_target_norm AND ur.role = 'admin'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'cannot_delete_admin');
  END IF;

  SELECT wallet_address INTO v_admin_wallet
    FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;

  SELECT user_id INTO v_target_user_id
    FROM public.profiles WHERE lower(wallet_address) = v_target_norm LIMIT 1;

  -- Log first
  INSERT INTO public.user_moderation_log
    (target_wallet_address, target_role, action, reason, performed_by_wallet, performed_by_user_id, metadata)
  VALUES (v_target_norm, p_target_role, 'delete', p_reason, COALESCE(v_admin_wallet,''), auth.uid(),
          jsonb_build_object('target_user_id', v_target_user_id));

  -- Soft cleanup of role-specific data
  IF p_target_role = 'merchant' THEN
    DELETE FROM public.merchant_profiles WHERE lower(merchant_address) = v_target_norm;
    DELETE FROM public.merchant_employees WHERE lower(merchant_address) = v_target_norm;
    DELETE FROM public.merchant_branches WHERE lower(merchant_address) = v_target_norm;
    DELETE FROM public.merchant_invites WHERE lower(merchant_address) = v_target_norm;
  ELSE
    DELETE FROM public.customer_profiles WHERE lower(wallet_address) = v_target_norm;
  END IF;

  -- Remove profile (auth.users record stays — managed by Supabase auth)
  DELETE FROM public.profiles WHERE lower(wallet_address) = v_target_norm;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Admin listing functions (bypass RLS via SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.admin_list_merchants()
RETURNS TABLE (
  wallet_address text,
  business_name text,
  category text,
  email text,
  is_banned boolean,
  banned_at timestamptz,
  ban_reason text,
  created_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.wallet_address,
    mp.business_name,
    mp.category,
    p.email,
    p.is_banned,
    p.banned_at,
    p.ban_reason,
    p.created_at
  FROM public.profiles p
  INNER JOIN public.merchant_profiles mp
    ON lower(mp.merchant_address) = lower(p.wallet_address)
  WHERE public.is_admin()
  ORDER BY p.is_banned DESC, p.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_customers()
RETURNS TABLE (
  wallet_address text,
  email text,
  first_name text,
  last_name text,
  is_banned boolean,
  banned_at timestamptz,
  ban_reason text,
  created_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.wallet_address,
    p.email,
    cp.first_name,
    cp.last_name,
    p.is_banned,
    p.banned_at,
    p.ban_reason,
    p.created_at
  FROM public.profiles p
  LEFT JOIN public.customer_profiles cp
    ON lower(cp.wallet_address) = lower(p.wallet_address)
  WHERE public.is_admin()
    AND NOT EXISTS (
      SELECT 1 FROM public.merchant_profiles mp
      WHERE lower(mp.merchant_address) = lower(p.wallet_address)
    )
  ORDER BY p.is_banned DESC, p.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.admin_user_moderation_history(p_wallet text)
RETURNS TABLE (
  id uuid,
  action text,
  reason text,
  performed_by_wallet text,
  created_at timestamptz,
  target_role text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, action, reason, performed_by_wallet, created_at, target_role
  FROM public.user_moderation_log
  WHERE lower(target_wallet_address) = lower(p_wallet)
    AND public.is_admin()
  ORDER BY created_at DESC;
$$;

-- Block banned users from making changes via RLS on key tables
CREATE POLICY "Block banned from creating programs"
  ON public.loyalty_programs FOR INSERT
  TO authenticated
  WITH CHECK (NOT public.is_current_user_banned());

CREATE POLICY "Block banned from creating offers"
  ON public.marketplace_offers FOR INSERT
  TO authenticated
  WITH CHECK (NOT public.is_current_user_banned());

CREATE POLICY "Block banned from creating campaigns"
  ON public.marketing_campaigns AS RESTRICTIVE FOR ALL
  TO authenticated
  USING (NOT public.is_current_user_banned())
  WITH CHECK (NOT public.is_current_user_banned());
