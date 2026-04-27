-- =========================================================
-- Gift Certificates: table, RLS, code generator, storage
-- =========================================================

CREATE TABLE IF NOT EXISTS public.gift_certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  merchant_address text NOT NULL,
  token_address text NOT NULL,
  token_symbol text,

  usd_amount numeric NOT NULL CHECK (usd_amount > 0),
  points_per_dollar numeric NOT NULL CHECK (points_per_dollar > 0),
  token_amount numeric NOT NULL CHECK (token_amount > 0),
  max_redemption_percent numeric NOT NULL DEFAULT 100
    CHECK (max_redemption_percent >= 0 AND max_redemption_percent <= 100),

  title text NOT NULL DEFAULT 'Gift Certificate',
  description text,
  image_url text,

  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','redeemed','expired','revoked')),

  redeemed_by text,
  redeemed_at timestamptz,
  mint_tx_hash text,

  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gift_certificates_merchant
  ON public.gift_certificates (lower(merchant_address));
CREATE INDEX IF NOT EXISTS idx_gift_certificates_redeemed_by
  ON public.gift_certificates (lower(redeemed_by));
CREATE INDEX IF NOT EXISTS idx_gift_certificates_token
  ON public.gift_certificates (lower(token_address));
CREATE INDEX IF NOT EXISTS idx_gift_certificates_status
  ON public.gift_certificates (status);

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_gift_certificates_updated_at ON public.gift_certificates;
CREATE TRIGGER trg_gift_certificates_updated_at
  BEFORE UPDATE ON public.gift_certificates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- RLS
-- =========================================================
ALTER TABLE public.gift_certificates ENABLE ROW LEVEL SECURITY;

-- Merchants manage their own certificates
CREATE POLICY "Merchants manage own certificates"
ON public.gift_certificates
FOR ALL
TO authenticated
USING (
  lower(merchant_address) = lower((
    SELECT wallet_address FROM public.profiles WHERE user_id = auth.uid()
  ))
)
WITH CHECK (
  lower(merchant_address) = lower((
    SELECT wallet_address FROM public.profiles WHERE user_id = auth.uid()
  ))
);

-- Block banned merchants from creating certificates
CREATE POLICY "Block banned from creating certificates"
ON public.gift_certificates
FOR INSERT
TO authenticated
WITH CHECK (NOT public.is_current_user_banned());

-- Customers can see certificates they have redeemed (own history)
CREATE POLICY "Customers view own redeemed certificates"
ON public.gift_certificates
FOR SELECT
TO authenticated
USING (
  redeemed_by IS NOT NULL
  AND lower(redeemed_by) = lower((
    SELECT wallet_address FROM public.profiles WHERE user_id = auth.uid()
  ))
);

-- Service role full access (for redeem-certificate edge function)
CREATE POLICY "Service role full access certificates"
ON public.gift_certificates
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- =========================================================
-- 6-digit code generator (collision-safe within active codes)
-- Returns LOYAL-XXXXXX where X is uppercase alphanumeric
-- =========================================================
CREATE OR REPLACE FUNCTION public.generate_certificate_code()
RETURNS text
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- exclude I,O,0,1 for readability
  v_code text;
  v_full text;
  v_exists boolean;
  v_i int;
BEGIN
  LOOP
    v_code := '';
    FOR v_i IN 1..6 LOOP
      v_code := v_code || substr(v_chars, 1 + floor(random() * length(v_chars))::int, 1);
    END LOOP;
    v_full := 'LOYAL-' || v_code;
    SELECT EXISTS(SELECT 1 FROM public.gift_certificates WHERE code = v_full) INTO v_exists;
    EXIT WHEN NOT v_exists;
  END LOOP;
  RETURN v_full;
END;
$$;

-- =========================================================
-- Public lookup function: anyone can preview a certificate by code
-- (returns minimal info — no PII, no redeemer details)
-- =========================================================
CREATE OR REPLACE FUNCTION public.lookup_certificate(p_code text)
RETURNS TABLE(
  id uuid,
  code text,
  merchant_address text,
  token_address text,
  token_symbol text,
  usd_amount numeric,
  token_amount numeric,
  points_per_dollar numeric,
  max_redemption_percent numeric,
  title text,
  description text,
  image_url text,
  status text,
  expires_at timestamptz,
  created_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    g.id, g.code, g.merchant_address, g.token_address, g.token_symbol,
    g.usd_amount, g.token_amount, g.points_per_dollar, g.max_redemption_percent,
    g.title, g.description, g.image_url, g.status, g.expires_at, g.created_at
  FROM public.gift_certificates g
  WHERE upper(trim(g.code)) = upper(trim(p_code))
  LIMIT 1;
$$;

-- =========================================================
-- Storage bucket for certificate images (public read)
-- =========================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('certificate-images', 'certificate-images', true)
ON CONFLICT (id) DO NOTHING;

-- Public read
CREATE POLICY "Certificate images public read"
ON storage.objects
FOR SELECT
USING (bucket_id = 'certificate-images');

-- Authenticated merchants can upload to their own folder (folder = wallet address)
CREATE POLICY "Merchants upload own certificate images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'certificate-images'
  AND lower((storage.foldername(name))[1]) = lower((
    SELECT wallet_address FROM public.profiles WHERE user_id = auth.uid()
  ))
);

CREATE POLICY "Merchants update own certificate images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'certificate-images'
  AND lower((storage.foldername(name))[1]) = lower((
    SELECT wallet_address FROM public.profiles WHERE user_id = auth.uid()
  ))
);

CREATE POLICY "Merchants delete own certificate images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'certificate-images'
  AND lower((storage.foldername(name))[1]) = lower((
    SELECT wallet_address FROM public.profiles WHERE user_id = auth.uid()
  ))
);