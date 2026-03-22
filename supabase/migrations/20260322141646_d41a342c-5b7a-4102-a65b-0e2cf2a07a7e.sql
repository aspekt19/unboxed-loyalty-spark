
-- Add subscription payment wallet to payment_settings
ALTER TABLE public.payment_settings ADD COLUMN IF NOT EXISTS subscription_wallet_address text;

-- Add agent plan subscription tracking
CREATE TABLE public.agent_plan_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_address text NOT NULL,
  plan_id uuid REFERENCES public.agent_plans(id) NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  amount_usdc numeric NOT NULL,
  transaction_hash text,
  paid_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.agent_plan_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view own subscriptions" ON public.agent_plan_subscriptions
  FOR SELECT TO authenticated
  USING (owner_address = (SELECT wallet_address FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Owners can insert own subscriptions" ON public.agent_plan_subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (owner_address = (SELECT wallet_address FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Service role full access plan subs" ON public.agent_plan_subscriptions
  FOR ALL TO service_role USING (true) WITH CHECK (true);
