-- =========================================================
-- Identity links: unified (link_type, value) schema
-- =========================================================

-- 1) New columns (nullable first; we'll backfill then enforce)
ALTER TABLE public.identity_links
  ADD COLUMN IF NOT EXISTS link_type text,
  ADD COLUMN IF NOT EXISTS value text,
  ADD COLUMN IF NOT EXISTS value_normalized text,
  ADD COLUMN IF NOT EXISTS verified_via text;

-- 2) Backfill from legacy columns
UPDATE public.identity_links
SET link_type = 'wallet',
    value = wallet_address,
    value_normalized = lower(wallet_address),
    verified_via = COALESCE(linked_via, 'unknown')
WHERE link_type IS NULL
  AND wallet_address IS NOT NULL;

-- 3) Make wallet_address nullable (legacy, kept for rollback window)
ALTER TABLE public.identity_links
  ALTER COLUMN wallet_address DROP NOT NULL;

-- 4) Enforce NOT NULL on new columns
ALTER TABLE public.identity_links
  ALTER COLUMN link_type SET NOT NULL,
  ALTER COLUMN value SET NOT NULL,
  ALTER COLUMN value_normalized SET NOT NULL,
  ALTER COLUMN verified_via SET NOT NULL;

-- 5) Constrain link_type
ALTER TABLE public.identity_links
  DROP CONSTRAINT IF EXISTS identity_links_link_type_check;
ALTER TABLE public.identity_links
  ADD CONSTRAINT identity_links_link_type_check
  CHECK (link_type IN ('wallet', 'email', 'privy_did'));

-- 6) Auto-normalize value_normalized via trigger (immutable enforcement)
CREATE OR REPLACE FUNCTION public.identity_links_normalize_value()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.value_normalized := lower(trim(NEW.value));
  IF NEW.link_type = 'wallet' THEN
    -- Keep wallet_address legacy column in sync for the transition period
    NEW.wallet_address := NEW.value_normalized;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_identity_links_normalize ON public.identity_links;
CREATE TRIGGER trg_identity_links_normalize
BEFORE INSERT OR UPDATE OF value, link_type ON public.identity_links
FOR EACH ROW EXECUTE FUNCTION public.identity_links_normalize_value();

-- 7) Unique indexes
DROP INDEX IF EXISTS identity_links_user_wallet_key;
DROP INDEX IF EXISTS identity_links_wallet_unique;

CREATE UNIQUE INDEX IF NOT EXISTS identity_links_type_value_uniq
  ON public.identity_links (link_type, value_normalized);

CREATE UNIQUE INDEX IF NOT EXISTS identity_links_user_primary_uniq
  ON public.identity_links (user_id, link_type)
  WHERE is_primary = true;

CREATE INDEX IF NOT EXISTS identity_links_user_id_idx
  ON public.identity_links (user_id);

-- =========================================================
-- RLS (re-confirm; identity_links must already have RLS enabled)
-- =========================================================
ALTER TABLE public.identity_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "identity_links_select_own" ON public.identity_links;
CREATE POLICY "identity_links_select_own"
  ON public.identity_links FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Writes are only allowed via SECURITY DEFINER RPCs below
DROP POLICY IF EXISTS "identity_links_no_direct_insert" ON public.identity_links;
DROP POLICY IF EXISTS "identity_links_no_direct_update" ON public.identity_links;
DROP POLICY IF EXISTS "identity_links_no_direct_delete" ON public.identity_links;

-- =========================================================
-- RPCs
-- =========================================================

-- link_identity: attaches a (type, value) to current auth.uid()
CREATE OR REPLACE FUNCTION public.link_identity(
  p_link_type text,
  p_value text,
  p_verified_via text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_norm text := lower(trim(p_value));
  v_existing record;
  v_new_id uuid;
  v_set_primary boolean := false;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF p_link_type NOT IN ('wallet','email','privy_did') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_link_type');
  END IF;

  IF v_norm IS NULL OR v_norm = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_value');
  END IF;

  IF p_link_type = 'wallet' AND v_norm !~ '^0x[a-f0-9]{40}$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_wallet_format');
  END IF;

  IF p_link_type = 'email' AND v_norm !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_email_format');
  END IF;

  -- Already linked?
  SELECT id, user_id INTO v_existing
  FROM public.identity_links
  WHERE link_type = p_link_type AND value_normalized = v_norm
  LIMIT 1;

  IF v_existing.id IS NOT NULL THEN
    IF v_existing.user_id = v_user THEN
      RETURN jsonb_build_object('ok', true, 'id', v_existing.id, 'already_linked', true);
    ELSE
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'identity_taken',
        'message', 'This identifier is already linked to another account.'
      );
    END IF;
  END IF;

  -- Promote to primary if user has no primary of this type yet
  IF NOT EXISTS (
    SELECT 1 FROM public.identity_links
    WHERE user_id = v_user AND link_type = p_link_type AND is_primary = true
  ) THEN
    v_set_primary := true;
  END IF;

  INSERT INTO public.identity_links (user_id, link_type, value, value_normalized, verified_via, is_primary)
  VALUES (v_user, p_link_type, p_value, v_norm, p_verified_via, v_set_primary)
  RETURNING id INTO v_new_id;

  RETURN jsonb_build_object('ok', true, 'id', v_new_id, 'is_primary', v_set_primary);
END;
$$;

-- unlink_identity: removes a link; forbids removing last/primary without replacement
CREATE OR REPLACE FUNCTION public.unlink_identity(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_link record;
  v_count integer;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT * INTO v_link FROM public.identity_links WHERE id = p_id LIMIT 1;
  IF v_link IS NULL OR v_link.user_id <> v_user THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  -- For wallets: cannot remove the last one
  IF v_link.link_type = 'wallet' THEN
    SELECT count(*) INTO v_count FROM public.identity_links
      WHERE user_id = v_user AND link_type = 'wallet';
    IF v_count <= 1 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'cannot_remove_last_wallet');
    END IF;
  END IF;

  -- Cannot remove primary unless another link of same type exists
  IF v_link.is_primary THEN
    SELECT count(*) INTO v_count FROM public.identity_links
      WHERE user_id = v_user AND link_type = v_link.link_type AND id <> p_id;
    IF v_count = 0 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'cannot_remove_primary_without_replacement');
    END IF;
  END IF;

  DELETE FROM public.identity_links WHERE id = p_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- set_primary: generic version (any link_type)
CREATE OR REPLACE FUNCTION public.set_primary_identity(p_link_type text, p_value text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_norm text := lower(trim(p_value));
  v_exists boolean;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF p_link_type NOT IN ('wallet','email','privy_did') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_link_type');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.identity_links
    WHERE user_id = v_user AND link_type = p_link_type AND value_normalized = v_norm
  ) INTO v_exists;

  IF NOT v_exists THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_linked');
  END IF;

  -- Drop current primary, then set new one (two-step to satisfy partial unique idx)
  UPDATE public.identity_links SET is_primary = false
    WHERE user_id = v_user AND link_type = p_link_type AND is_primary = true;
  UPDATE public.identity_links SET is_primary = true
    WHERE user_id = v_user AND link_type = p_link_type AND value_normalized = v_norm;

  RETURN jsonb_build_object('ok', true, 'link_type', p_link_type, 'value', v_norm);
END;
$$;

-- Backwards-compatible wrapper for the old name
CREATE OR REPLACE FUNCTION public.set_primary_wallet(p_wallet_address text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.set_primary_identity('wallet', p_wallet_address);
END;
$$;

-- get_my_identity_summary: rewritten for new schema
CREATE OR REPLACE FUNCTION public.get_my_identity_summary()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_primary_wallet text;
  v_primary_email text;
  v_wallets jsonb;
  v_emails jsonb;
  v_profile_email text;
  v_profile_phone text;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT value_normalized INTO v_primary_wallet
  FROM public.identity_links
  WHERE user_id = v_user AND link_type = 'wallet' AND is_primary = true
  LIMIT 1;

  SELECT value_normalized INTO v_primary_email
  FROM public.identity_links
  WHERE user_id = v_user AND link_type = 'email' AND is_primary = true
  LIMIT 1;

  SELECT jsonb_agg(jsonb_build_object(
    'id', id,
    'value', value_normalized,
    'verified_via', verified_via,
    'is_primary', is_primary,
    'verified_at', verified_at
  ) ORDER BY is_primary DESC, created_at ASC)
  INTO v_wallets
  FROM public.identity_links
  WHERE user_id = v_user AND link_type = 'wallet';

  SELECT jsonb_agg(jsonb_build_object(
    'id', id,
    'value', value_normalized,
    'verified_via', verified_via,
    'is_primary', is_primary,
    'verified_at', verified_at
  ) ORDER BY is_primary DESC, created_at ASC)
  INTO v_emails
  FROM public.identity_links
  WHERE user_id = v_user AND link_type = 'email';

  SELECT email, phone INTO v_profile_email, v_profile_phone
  FROM public.profiles WHERE user_id = v_user LIMIT 1;

  RETURN jsonb_build_object(
    'ok', true,
    'primary_wallet', v_primary_wallet,
    'primary_email', v_primary_email,
    'wallets', COALESCE(v_wallets, '[]'::jsonb),
    'emails', COALESCE(v_emails, '[]'::jsonb),
    'profile_email', v_profile_email,
    'profile_phone', v_profile_phone
  );
END;
$$;

-- Grants for RPCs
GRANT EXECUTE ON FUNCTION public.link_identity(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unlink_identity(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_primary_identity(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_primary_wallet(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_identity_summary() TO authenticated;