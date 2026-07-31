-- Atomic per-agent per-minute API rate limit counter (fixes check-then-act race on activity_log).
-- Consumed by supabase/functions/_shared/agent-rate-limit.ts via service_role only.

CREATE TABLE IF NOT EXISTS public.agent_api_rate_windows (
  agent_id uuid NOT NULL,
  agent_kind text NOT NULL CHECK (agent_kind IN ('merchant', 'recipient')),
  window_start timestamptz NOT NULL,
  request_count integer NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (agent_id, agent_kind, window_start)
);

COMMENT ON TABLE public.agent_api_rate_windows IS
  'Sliding minute buckets for agent API per-minute limits. Written only via consume_agent_rate_limit RPC.';

CREATE INDEX IF NOT EXISTS agent_api_rate_windows_window_start_idx
  ON public.agent_api_rate_windows (window_start);

ALTER TABLE public.agent_api_rate_windows ENABLE ROW LEVEL SECURITY;

-- No public / authenticated access — Edge Functions use service_role.
CREATE POLICY "No public access agent_api_rate_windows"
  ON public.agent_api_rate_windows
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY "Service role full agent_api_rate_windows"
  ON public.agent_api_rate_windows
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.consume_agent_rate_limit(
  p_agent_id uuid,
  p_agent_kind text,
  p_limit integer,
  p_window_seconds integer DEFAULT 60
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kind text;
  v_window_start timestamptz;
  v_count integer;
  v_window integer;
BEGIN
  IF p_agent_id IS NULL THEN
    RAISE EXCEPTION 'p_agent_id required';
  END IF;

  v_kind := lower(coalesce(p_agent_kind, ''));
  IF v_kind NOT IN ('merchant', 'recipient') THEN
    RAISE EXCEPTION 'p_agent_kind must be merchant or recipient';
  END IF;

  -- Non-positive / null limit = unlimited for this call.
  IF p_limit IS NULL OR p_limit <= 0 THEN
    RETURN true;
  END IF;

  v_window := GREATEST(coalesce(p_window_seconds, 60), 1);
  -- Align to fixed window boundaries (default: calendar minute when window=60).
  v_window_start := to_timestamp(
    floor(extract(epoch FROM now()) / v_window) * v_window
  );

  INSERT INTO public.agent_api_rate_windows AS w (agent_id, agent_kind, window_start, request_count, updated_at)
  VALUES (p_agent_id, v_kind, v_window_start, 1, now())
  ON CONFLICT (agent_id, agent_kind, window_start)
  DO UPDATE SET
    request_count = w.request_count + 1,
    updated_at = now()
  RETURNING w.request_count INTO v_count;

  RETURN v_count <= p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_agent_rate_limit(uuid, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_agent_rate_limit(uuid, text, integer, integer) TO service_role;
