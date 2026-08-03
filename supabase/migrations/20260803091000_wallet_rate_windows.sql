-- Atomic per-wallet rate limit buckets for expensive non-agent endpoints
-- (first consumer: get-token-holders, which fans out to many Base RPC calls).

CREATE TABLE IF NOT EXISTS public.wallet_rate_windows (
  scope text NOT NULL,
  subject text NOT NULL,
  window_start timestamptz NOT NULL,
  request_count integer NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scope, subject, window_start)
);

COMMENT ON TABLE public.wallet_rate_windows IS
  'Fixed windows for per-wallet limits on expensive Edge Functions. Written only via consume_wallet_rate_limit RPC.';

CREATE INDEX IF NOT EXISTS wallet_rate_windows_window_start_idx
  ON public.wallet_rate_windows (window_start);

ALTER TABLE public.wallet_rate_windows ENABLE ROW LEVEL SECURITY;

-- No public / authenticated access — Edge Functions use service_role.
CREATE POLICY "No public access wallet_rate_windows"
  ON public.wallet_rate_windows
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY "Service role full wallet_rate_windows"
  ON public.wallet_rate_windows
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

GRANT ALL ON public.wallet_rate_windows TO service_role;

CREATE OR REPLACE FUNCTION public.consume_wallet_rate_limit(
  p_scope text,
  p_subject text,
  p_limit integer,
  p_window_seconds integer DEFAULT 60
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_scope text;
  v_subject text;
  v_window integer;
  v_window_start timestamptz;
  v_count integer;
BEGIN
  v_scope := lower(trim(coalesce(p_scope, '')));
  v_subject := lower(trim(coalesce(p_subject, '')));
  IF v_scope = '' OR v_subject = '' THEN
    RAISE EXCEPTION 'p_scope and p_subject required';
  END IF;

  -- Non-positive / null limit = unlimited for this call.
  IF p_limit IS NULL OR p_limit <= 0 THEN
    RETURN true;
  END IF;

  v_window := GREATEST(coalesce(p_window_seconds, 60), 1);
  v_window_start := to_timestamp(
    floor(extract(epoch FROM now()) / v_window) * v_window
  );

  INSERT INTO public.wallet_rate_windows AS w (scope, subject, window_start, request_count, updated_at)
  VALUES (v_scope, v_subject, v_window_start, 1, now())
  ON CONFLICT (scope, subject, window_start)
  DO UPDATE SET
    request_count = w.request_count + 1,
    updated_at = now()
  RETURNING w.request_count INTO v_count;

  RETURN v_count <= p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_wallet_rate_limit(text, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_wallet_rate_limit(text, text, integer, integer) TO service_role;
