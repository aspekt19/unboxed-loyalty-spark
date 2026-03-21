
-- AI Agent Registry
CREATE TABLE public.agent_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  owner_address text NOT NULL,
  agent_wallet_address text,
  api_key_hash text NOT NULL,
  api_key_prefix text NOT NULL,
  scopes text[] DEFAULT '{read}',
  is_active boolean DEFAULT true,
  rate_limit_per_minute int DEFAULT 60,
  total_requests bigint DEFAULT 0,
  last_request_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Agent Activity Log
CREATE TABLE public.agent_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid REFERENCES agent_registry(id) ON DELETE CASCADE NOT NULL,
  action text NOT NULL,
  request_body jsonb,
  response_status int,
  response_body jsonb,
  ip_address text,
  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.agent_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage own agents" ON public.agent_registry
  FOR ALL TO authenticated
  USING (owner_address = (SELECT wallet_address FROM profiles WHERE user_id = auth.uid()))
  WITH CHECK (owner_address = (SELECT wallet_address FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Owners can view agent activity" ON public.agent_activity_log
  FOR SELECT TO authenticated
  USING (agent_id IN (
    SELECT id FROM agent_registry
    WHERE owner_address = (SELECT wallet_address FROM profiles WHERE user_id = auth.uid())
  ));

-- Service role full access for edge functions
CREATE POLICY "Service role full access agents" ON public.agent_registry
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access activity" ON public.agent_activity_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);
