-- Allow new intermediate status
ALTER TABLE public.gift_certificates
  DROP CONSTRAINT IF EXISTS gift_certificates_status_check;

ALTER TABLE public.gift_certificates
  ADD CONSTRAINT gift_certificates_status_check
  CHECK (status IN ('active','pending_mint','redeemed','expired','revoked'));

-- =========================================================
-- claim_gift_certificate: customer activates by code
-- =========================================================
CREATE OR REPLACE FUNCTION public.claim_gift_certificate(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_wallet text;
  v_cert record;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF p_code IS NULL OR trim(p_code) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_code');
  END IF;

  SELECT wallet_address INTO v_wallet
  FROM public.profiles
  WHERE user_id = v_user
  LIMIT 1;

  IF v_wallet IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_wallet');
  END IF;

  -- Lock the row to avoid double-claim
  SELECT * INTO v_cert
  FROM public.gift_certificates
  WHERE upper(trim(code)) = upper(trim(p_code))
  FOR UPDATE;

  IF v_cert IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF v_cert.status = 'redeemed' OR v_cert.status = 'pending_mint' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_redeemed');
  END IF;

  IF v_cert.status = 'revoked' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'revoked');
  END IF;

  IF v_cert.expires_at IS NOT NULL AND v_cert.expires_at < now() THEN
    UPDATE public.gift_certificates SET status = 'expired' WHERE id = v_cert.id;
    RETURN jsonb_build_object('ok', false, 'error', 'expired');
  END IF;

  -- Self-claim by merchant disallowed
  IF lower(v_wallet) = lower(v_cert.merchant_address) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'cannot_claim_own');
  END IF;

  UPDATE public.gift_certificates
  SET status = 'pending_mint',
      redeemed_by = lower(v_wallet),
      redeemed_at = now()
  WHERE id = v_cert.id;

  RETURN jsonb_build_object(
    'ok', true,
    'certificate_id', v_cert.id,
    'token_address', v_cert.token_address,
    'token_amount', v_cert.token_amount,
    'merchant_address', v_cert.merchant_address,
    'title', v_cert.title
  );
END;
$$;

-- =========================================================
-- mark_certificate_minted: merchant confirms on-chain mint
-- =========================================================
CREATE OR REPLACE FUNCTION public.mark_certificate_minted(p_certificate_id uuid, p_tx_hash text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_wallet text;
  v_cert record;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT wallet_address INTO v_wallet
  FROM public.profiles WHERE user_id = v_user LIMIT 1;
  IF v_wallet IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_wallet');
  END IF;

  SELECT * INTO v_cert FROM public.gift_certificates WHERE id = p_certificate_id FOR UPDATE;
  IF v_cert IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF lower(v_cert.merchant_address) <> lower(v_wallet) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  IF v_cert.status <> 'pending_mint' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_status');
  END IF;

  UPDATE public.gift_certificates
  SET status = 'redeemed',
      mint_tx_hash = p_tx_hash
  WHERE id = p_certificate_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;