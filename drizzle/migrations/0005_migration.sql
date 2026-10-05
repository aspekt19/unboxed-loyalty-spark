CREATE TABLE public.gas_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  monthly_budget_usd numeric NOT NULL DEFAULT 50 CHECK (monthly_budget_usd >= 0),
  sponsor_smart_wallets boolean NOT NULL DEFAULT true,
  drip_enabled boolean NOT NULL DEFAULT true,
  drip_amount_usd numeric NOT NULL DEFAULT 0.02 CHECK (drip_amount_usd > 0 AND drip_amount_usd <= 1),
  drip_min_balance_usd numeric NOT NULL DEFAULT 0.005 CHECK (drip_min_balance_usd >= 0),
  drip_cooldown_days integer NOT NULL DEFAULT 7 CHECK (drip_cooldown_days >= 0),
  drip_max_per_month integer NOT NULL DEFAULT 3 CHECK (drip_max_per_month >= 0),
  est_sponsored_op_usd numeric NOT NULL DEFAULT 0.01 CHECK (est_sponsored_op_usd >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);
GRANT SELECT, UPDATE ON public.gas_settings TO authenticated;
GRANT ALL ON public.gas_settings TO service_role;
ALTER TABLE public.gas_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read gas settings" ON public.gas_settings FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update gas settings" ON public.gas_settings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
INSERT INTO public.gas_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

CREATE TABLE public.gas_drips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address text NOT NULL,
  user_id uuid,
  amount_wei numeric NOT NULL,
  amount_usd numeric NOT NULL,
  tx_hash text,
  status text NOT NULL DEFAULT 'sent',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX gas_drips_wallet_idx ON public.gas_drips (lower(wallet_address), created_at DESC);
GRANT SELECT ON public.gas_drips TO authenticated;
GRANT ALL ON public.gas_drips TO service_role;
ALTER TABLE public.gas_drips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read gas drips" ON public.gas_drips FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.gas_sponsorships ADD COLUMN IF NOT EXISTS est_cost_usd numeric;
GRANT SELECT ON public.gas_sponsorships TO authenticated;
CREATE POLICY "Admins read gas sponsorships" ON public.gas_sponsorships FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.gas_month_spent_usd()
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT sum(amount_usd) FROM gas_drips WHERE status = 'sent' AND created_at >= date_trunc('month', now())), 0)
       + COALESCE((SELECT sum(est_cost_usd) FROM gas_sponsorships WHERE created_at >= date_trunc('month', now())), 0)
$$;
REVOKE ALL ON FUNCTION public.gas_month_spent_usd() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gas_month_spent_usd() TO authenticated, service_role;