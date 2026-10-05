CREATE TABLE public.gas_sponsorships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address text NOT NULL,
  merchant_address text,
  targets text[] NOT NULL DEFAULT '{}',
  method text NOT NULL,
  tx_hash text,
  gas_cost_wei numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX gas_sponsorships_wallet_idx ON public.gas_sponsorships (lower(wallet_address), created_at DESC);
GRANT ALL ON public.gas_sponsorships TO service_role;
ALTER TABLE public.gas_sponsorships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_plans ADD COLUMN IF NOT EXISTS monthly_gas_sponsor_cap_usd numeric;