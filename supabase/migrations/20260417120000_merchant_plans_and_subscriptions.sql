-- Merchant SaaS plans (portal). Settlement uses the same wallet as agent plans:
-- public.payment_settings.subscription_wallet_address (USDC on Base).

CREATE TABLE public.merchant_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  price_usdc_monthly numeric NOT NULL DEFAULT 0,
  features jsonb DEFAULT '[]'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.merchant_plan_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_address text NOT NULL,
  plan_id uuid REFERENCES public.merchant_plans(id) NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  amount_usdc numeric NOT NULL,
  transaction_hash text,
  paid_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.merchant_profiles
  ADD COLUMN IF NOT EXISTS merchant_plan_id uuid REFERENCES public.merchant_plans(id);

CREATE INDEX IF NOT EXISTS idx_merchant_plan_subscriptions_owner ON public.merchant_plan_subscriptions (lower(owner_address));
CREATE INDEX IF NOT EXISTS idx_merchant_plan_subscriptions_status ON public.merchant_plan_subscriptions (status);

ALTER TABLE public.merchant_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active merchant plans" ON public.merchant_plans FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage merchant plans" ON public.merchant_plans FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

ALTER TABLE public.merchant_plan_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners can view own merchant subs" ON public.merchant_plan_subscriptions FOR SELECT TO authenticated
  USING (owner_address = (SELECT wallet_address FROM profiles WHERE user_id = auth.uid()));
CREATE POLICY "Owners can insert own merchant subs" ON public.merchant_plan_subscriptions FOR INSERT TO authenticated
  WITH CHECK (owner_address = (SELECT wallet_address FROM profiles WHERE user_id = auth.uid()));
CREATE POLICY "Service role full merchant subs" ON public.merchant_plan_subscriptions FOR ALL TO service_role USING (true) WITH CHECK (true);

INSERT INTO public.merchant_plans (name, slug, description, price_usdc_monthly, features) VALUES
(
  'Starter',
  'starter',
  'SMB entry — merchant portal, loyalty programs, customer CRM',
  39,
  '["Merchant dashboard", "Programs & rewards", "Customer list", "Marketing tools", "Team invites (owner)"]'::jsonb
),
(
  'Growth',
  'growth',
  'Growing businesses — higher limits and deeper analytics',
  79,
  '["Everything in Starter", "Higher operational limits", "Priority positioning", "Expanded analytics"]'::jsonb
),
(
  'Scale',
  'scale',
  'Large or multi-location — priority support and scale',
  149,
  '["Everything in Growth", "Enterprise-style limits", "Priority support", "Custom integration path"]'::jsonb
)
ON CONFLICT (slug) DO NOTHING;

COMMENT ON TABLE public.merchant_plans IS 'Published merchant SaaS tiers; prices in USDC / month.';
COMMENT ON TABLE public.merchant_plan_subscriptions IS 'USDC payment records for merchant portal plans; same settlement wallet as agent plans.';
COMMENT ON COLUMN public.merchant_profiles.merchant_plan_id IS 'Optional cache of active SaaS tier; subscriptions table is authoritative.';
