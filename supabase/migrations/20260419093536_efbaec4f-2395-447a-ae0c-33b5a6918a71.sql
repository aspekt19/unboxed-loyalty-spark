-- Wallet-bound AI agents (recipient / holder keys: rwk_...), separate from merchant agent_registry (lsk_...).

CREATE TABLE IF NOT EXISTS public.recipient_agent_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address text NOT NULL,
  name text NOT NULL,
  api_key_hash text NOT NULL,
  api_key_prefix text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  rate_limit_per_minute integer NOT NULL DEFAULT 30,
  total_requests bigint NOT NULL DEFAULT 0,
  last_request_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT recipient_agent_registry_wallet_lower CHECK (wallet_address = lower(wallet_address))
);

CREATE UNIQUE INDEX IF NOT EXISTS recipient_agent_registry_api_key_hash_key
  ON public.recipient_agent_registry (api_key_hash);

CREATE INDEX IF NOT EXISTS recipient_agent_registry_wallet_idx
  ON public.recipient_agent_registry (wallet_address);

COMMENT ON TABLE public.recipient_agent_registry IS 'API keys for AI agents acting only as loyalty token recipients (rwk_ prefix).';

CREATE TABLE IF NOT EXISTS public.recipient_agent_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.recipient_agent_registry(id) ON DELETE CASCADE,
  action text NOT NULL,
  request_body jsonb,
  response_status integer,
  response_body jsonb,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS recipient_agent_activity_log_agent_time_idx
  ON public.recipient_agent_activity_log (agent_id, created_at DESC);

ALTER TABLE public.recipient_agent_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipient_agent_activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access recipient_agent_registry" ON public.recipient_agent_registry;
CREATE POLICY "Service role full access recipient_agent_registry"
  ON public.recipient_agent_registry FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access recipient_agent_activity_log" ON public.recipient_agent_activity_log;
CREATE POLICY "Service role full access recipient_agent_activity_log"
  ON public.recipient_agent_activity_log FOR ALL TO service_role USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';