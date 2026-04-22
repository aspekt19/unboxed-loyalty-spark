-- Re-create with explicit search_path (linter requirement)
CREATE OR REPLACE FUNCTION public.set_primary_wallet(p_wallet_address text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_norm text := lower(trim(p_wallet_address));
  v_exists boolean;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;
  IF v_norm IS NULL OR v_norm = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_wallet');
  END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.identity_links
    WHERE user_id = v_user AND lower(wallet_address) = v_norm
  ) INTO v_exists;
  IF NOT v_exists THEN
    RETURN jsonb_build_object('ok', false, 'error', 'wallet_not_linked');
  END IF;
  UPDATE public.identity_links SET is_primary = false
    WHERE user_id = v_user AND is_primary = true;
  UPDATE public.identity_links SET is_primary = true
    WHERE user_id = v_user AND lower(wallet_address) = v_norm;
  RETURN jsonb_build_object('ok', true, 'primary_wallet', v_norm);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_identity_summary()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_primary text;
  v_links jsonb;
  v_email text;
  v_phone text;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;
  SELECT lower(wallet_address) INTO v_primary
  FROM public.identity_links
  WHERE user_id = v_user AND is_primary = true LIMIT 1;
  SELECT jsonb_agg(jsonb_build_object(
    'wallet_address', lower(wallet_address),
    'linked_via', linked_via,
    'is_primary', is_primary,
    'verified_at', verified_at
  ) ORDER BY is_primary DESC, created_at ASC)
  INTO v_links
  FROM public.identity_links WHERE user_id = v_user;
  SELECT email, phone INTO v_email, v_phone
  FROM public.profiles WHERE user_id = v_user LIMIT 1;
  RETURN jsonb_build_object(
    'ok', true,
    'primary_wallet', v_primary,
    'linked_wallets', COALESCE(v_links, '[]'::jsonb),
    'email', v_email,
    'phone', v_phone
  );
END;
$$;