-- Ensure identity_links table exists (created in previous merge step). Add is_primary flag.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'identity_links'
  ) THEN
    CREATE TABLE public.identity_links (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL,
      wallet_address text NOT NULL,
      linked_via text NOT NULL DEFAULT 'wallet', -- 'wallet' | 'email' | 'phone'
      verified_at timestamptz NOT NULL DEFAULT now(),
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (user_id, wallet_address)
    );
    ALTER TABLE public.identity_links ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "Users can view own identity links"
      ON public.identity_links FOR SELECT
      TO authenticated
      USING (user_id = auth.uid());

    CREATE POLICY "Service role full access identity_links"
      ON public.identity_links FOR ALL
      TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Add is_primary column if missing
ALTER TABLE public.identity_links
  ADD COLUMN IF NOT EXISTS is_primary boolean NOT NULL DEFAULT false;

-- Partial unique index: ровно один primary на user_id
CREATE UNIQUE INDEX IF NOT EXISTS identity_links_one_primary_per_user
  ON public.identity_links (user_id)
  WHERE is_primary = true;

-- Бэкофилл: если у пользователя нет primary, ставим primary для текущего wallet_address из profiles
INSERT INTO public.identity_links (user_id, wallet_address, linked_via, is_primary)
SELECT p.user_id, lower(p.wallet_address), 'wallet', true
FROM public.profiles p
WHERE p.wallet_address IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.identity_links il WHERE il.user_id = p.user_id
  )
ON CONFLICT (user_id, wallet_address) DO NOTHING;

-- Если есть links но ни один не primary — сделаем primary тот, что совпадает с profiles.wallet_address
UPDATE public.identity_links il
SET is_primary = true
FROM public.profiles p
WHERE il.user_id = p.user_id
  AND lower(il.wallet_address) = lower(p.wallet_address)
  AND NOT EXISTS (
    SELECT 1 FROM public.identity_links il2
    WHERE il2.user_id = il.user_id AND il2.is_primary = true
  );

-- RPC: переключить основной кошелёк
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

  -- Снять primary со всех, поставить на выбранный
  UPDATE public.identity_links
    SET is_primary = false
    WHERE user_id = v_user AND is_primary = true;

  UPDATE public.identity_links
    SET is_primary = true
    WHERE user_id = v_user AND lower(wallet_address) = v_norm;

  RETURN jsonb_build_object('ok', true, 'primary_wallet', v_norm);
END;
$$;

-- RPC: сводка идентичности текущего пользователя
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
  WHERE user_id = v_user AND is_primary = true
  LIMIT 1;

  SELECT jsonb_agg(jsonb_build_object(
    'wallet_address', lower(wallet_address),
    'linked_via', linked_via,
    'is_primary', is_primary,
    'verified_at', verified_at
  ) ORDER BY is_primary DESC, created_at ASC)
  INTO v_links
  FROM public.identity_links
  WHERE user_id = v_user;

  SELECT email, phone INTO v_email, v_phone
  FROM public.profiles
  WHERE user_id = v_user
  LIMIT 1;

  RETURN jsonb_build_object(
    'ok', true,
    'primary_wallet', v_primary,
    'linked_wallets', COALESCE(v_links, '[]'::jsonb),
    'email', v_email,
    'phone', v_phone
  );
END;
$$;