
CREATE TABLE public.agent_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid REFERENCES public.agent_registry(id) ON DELETE CASCADE NOT NULL,
  wallet_address text NOT NULL,
  wallet_type text NOT NULL DEFAULT 'mock',
  chain_id integer NOT NULL DEFAULT 8453,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(agent_id, chain_id)
);

ALTER TABLE public.agent_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on agent_wallets"
  ON public.agent_wallets
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
