
-- Agent pricing plans table
CREATE TABLE public.agent_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  price_usdc_monthly numeric NOT NULL DEFAULT 0,
  price_eth_monthly numeric NOT NULL DEFAULT 0,
  max_api_calls_monthly integer, -- NULL = unlimited
  max_agents integer NOT NULL DEFAULT 1,
  max_mint_amount_monthly numeric, -- NULL = unlimited
  transaction_fee_percent numeric NOT NULL DEFAULT 0.5,
  features jsonb DEFAULT '[]'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Agent usage tracking table
CREATE TABLE public.agent_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_address text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  api_calls_count integer DEFAULT 0,
  mint_operations_count integer DEFAULT 0,
  mint_total_amount numeric DEFAULT 0,
  fees_collected_usdc numeric DEFAULT 0,
  fees_collected_eth numeric DEFAULT 0,
  plan_id uuid REFERENCES public.agent_plans(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(owner_address, period_start)
);

-- Add plan_id to agent_registry
ALTER TABLE public.agent_registry ADD COLUMN IF NOT EXISTS plan_id uuid REFERENCES public.agent_plans(id);

-- Transaction fee log
CREATE TABLE public.agent_fee_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid REFERENCES public.agent_registry(id) NOT NULL,
  operation text NOT NULL,
  token_address text NOT NULL,
  mint_amount numeric NOT NULL,
  fee_percent numeric NOT NULL,
  fee_amount numeric NOT NULL,
  recipient_address text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- RLS for agent_plans (public read, admin write)
ALTER TABLE public.agent_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active plans" ON public.agent_plans FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage plans" ON public.agent_plans FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- RLS for agent_usage (owner read, service_role write)
ALTER TABLE public.agent_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners can view own usage" ON public.agent_usage FOR SELECT TO authenticated
  USING (owner_address = (SELECT wallet_address FROM profiles WHERE user_id = auth.uid()));
CREATE POLICY "Service role full access usage" ON public.agent_usage FOR ALL TO service_role USING (true) WITH CHECK (true);

-- RLS for agent_fee_log (owner read via agent, service_role write)
ALTER TABLE public.agent_fee_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners can view own fees" ON public.agent_fee_log FOR SELECT TO authenticated
  USING (agent_id IN (SELECT id FROM agent_registry WHERE owner_address = (SELECT wallet_address FROM profiles WHERE user_id = auth.uid())));
CREATE POLICY "Service role full access fees" ON public.agent_fee_log FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Insert default plans
INSERT INTO public.agent_plans (name, slug, description, price_usdc_monthly, price_eth_monthly, max_api_calls_monthly, max_agents, max_mint_amount_monthly, transaction_fee_percent, features) VALUES
('Free', 'free', 'Get started with basic agent capabilities', 0, 0, 100, 1, 1000, 1.0, '["1 agent", "100 API calls/month", "1,000 tokens mint limit", "1% transaction fee", "Basic support"]'::jsonb),
('Pro', 'pro', 'Unlimited agents and advanced features for growing businesses', 29, 0.012, NULL, 10, NULL, 0.5, '["Up to 10 agents", "Unlimited API calls", "Unlimited minting", "0.5% transaction fee", "Priority support", "CRM analytics", "Automation rules"]'::jsonb),
('Enterprise', 'enterprise', 'Maximum power for large-scale operations', 99, 0.04, NULL, 100, NULL, 0.25, '["Up to 100 agents", "Unlimited everything", "0.25% transaction fee", "Dedicated support", "Custom integrations", "Multi-chain support", "SLA guarantee"]'::jsonb);
