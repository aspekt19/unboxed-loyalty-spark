-- Allow employees to redeem invite codes (RLS otherwise blocks INSERT on merchant_employees for non-owners)
CREATE OR REPLACE FUNCTION public.accept_merchant_invite(p_invite_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet text;
  v_inv_id uuid;
  v_merchant text;
  v_branch uuid;
  v_role public.merchant_employee_role;
BEGIN
  IF p_invite_code IS NULL OR length(trim(p_invite_code)) < 2 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_code');
  END IF;

  SELECT lower(trim(wallet_address)) INTO v_wallet
  FROM public.profiles
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF v_wallet IS NULL OR v_wallet = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_profile');
  END IF;

  SELECT i.id, lower(i.merchant_address), i.branch_id, i.role
  INTO v_inv_id, v_merchant, v_branch, v_role
  FROM public.merchant_invites i
  WHERE lower(trim(i.invite_code)) = lower(trim(p_invite_code))
    AND i.status = 'pending'
    AND (i.expires_at IS NULL OR i.expires_at > now())
  LIMIT 1;

  IF v_inv_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invite_not_found');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.merchant_employees e
    WHERE lower(e.merchant_address) = v_merchant
      AND lower(e.employee_wallet_address) = v_wallet
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_member');
  END IF;

  INSERT INTO public.merchant_employees (
    merchant_address,
    employee_wallet_address,
    branch_id,
    role,
    invited_by
  ) VALUES (
    v_merchant,
    v_wallet,
    v_branch,
    v_role,
    v_merchant
  );

  UPDATE public.merchant_invites
  SET
    status = 'used',
    used_by = v_wallet,
    used_at = now()
  WHERE id = v_inv_id;

  RETURN jsonb_build_object('ok', true, 'merchant_address', v_merchant);
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_member');
END;
$$;

REVOKE ALL ON FUNCTION public.accept_merchant_invite(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_merchant_invite(text) TO authenticated;

COMMENT ON FUNCTION public.accept_merchant_invite(text) IS
  'Redeem a pending merchant team invite; uses profiles.wallet_address for the current auth user.';
