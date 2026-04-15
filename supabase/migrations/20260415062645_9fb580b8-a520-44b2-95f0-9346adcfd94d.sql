
CREATE OR REPLACE FUNCTION public.accept_merchant_invite(p_invite_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_wallet text;
  v_invite record;
BEGIN
  -- Get caller wallet
  SELECT wallet_address INTO v_wallet
  FROM public.profiles
  WHERE user_id = auth.uid();

  IF v_wallet IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_profile');
  END IF;

  IF p_invite_code IS NULL OR trim(p_invite_code) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_code');
  END IF;

  -- Find pending invite by code
  SELECT * INTO v_invite
  FROM public.merchant_invites
  WHERE upper(invite_code) = upper(trim(p_invite_code))
    AND status = 'pending'
    AND (expires_at IS NULL OR expires_at > now())
  LIMIT 1;

  IF v_invite IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invite_not_found');
  END IF;

  -- Check target wallet match (if invite was created for a specific wallet)
  IF v_invite.target_wallet_address IS NOT NULL
     AND lower(v_invite.target_wallet_address) <> lower(v_wallet) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invite_not_found');
  END IF;

  -- Check not already a member
  IF EXISTS (
    SELECT 1 FROM public.merchant_employees
    WHERE lower(employee_wallet_address) = lower(v_wallet)
      AND lower(merchant_address) = lower(v_invite.merchant_address)
      AND is_active = true
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_member');
  END IF;

  -- Add employee
  INSERT INTO public.merchant_employees (
    employee_wallet_address,
    merchant_address,
    role,
    branch_id,
    invited_by,
    joined_at,
    is_active
  ) VALUES (
    lower(v_wallet),
    v_invite.merchant_address,
    v_invite.role,
    v_invite.branch_id,
    v_invite.merchant_address,
    now(),
    true
  );

  -- Mark invite as used
  UPDATE public.merchant_invites
  SET status = 'used',
      used_by = lower(v_wallet),
      used_at = now()
  WHERE id = v_invite.id;

  RETURN jsonb_build_object(
    'ok', true,
    'merchant_address', v_invite.merchant_address
  );
END;
$$;
