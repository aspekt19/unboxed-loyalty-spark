-- =============================================
-- PART 1: Agent plans pricing v2
-- =============================================
UPDATE public.agent_plans
SET
  max_api_calls_monthly = 200,
  transaction_fee_percent = 1.25,
  features = '["1 agent", "200 API calls/month", "1,000 tokens mint limit", "1.25% transaction fee", "Basic support"]'::jsonb,
  updated_at = now()
WHERE slug = 'free';

UPDATE public.agent_plans
SET
  price_usdc_monthly = 49,
  max_api_calls_monthly = 10000,
  max_agents = 5,
  transaction_fee_percent = 0.5,
  features = '["Up to 5 agents", "10,000 API calls/month", "Unlimited minting", "0.5% transaction fee", "Priority support", "CRM analytics", "Automation rules"]'::jsonb,
  updated_at = now()
WHERE slug = 'pro';

UPDATE public.agent_plans
SET
  price_usdc_monthly = 129,
  transaction_fee_percent = 0.25,
  features = '["Up to 100 agents", "Unlimited API calls", "Unlimited minting", "0.25% transaction fee", "Dedicated support", "Custom integrations", "Multi-chain support", "SLA guarantee"]'::jsonb,
  updated_at = now()
WHERE slug = 'enterprise';

-- =============================================
-- PART 2: Merchant plans & subscriptions
-- =============================================
CREATE TABLE IF NOT EXISTS public.merchant_plans (
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

CREATE TABLE IF NOT EXISTS public.merchant_plan_subscriptions (
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

-- =============================================
-- PART 3: Platform admin wallets + grandfathering
-- =============================================
CREATE TABLE IF NOT EXISTS public.platform_merchant_admin_wallets (
  wallet_address text PRIMARY KEY,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wallet_address_lower_hex CHECK (wallet_address ~* '^0x[a-f0-9]{40}$')
);

COMMENT ON TABLE public.platform_merchant_admin_wallets IS
  'Operator wallets: is_unrestricted_merchant() = true; no merchant tier limits.';

ALTER TABLE public.platform_merchant_admin_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No public access merchant admin wallets"
  ON public.platform_merchant_admin_wallets FOR ALL
  USING (false);

CREATE POLICY "Service role full merchant admin wallets"
  ON public.platform_merchant_admin_wallets FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.is_unrestricted_merchant(p_wallet text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.platform_merchant_admin_wallets a
    WHERE lower(a.wallet_address) = lower(trim(p_wallet))
  );
$$;

REVOKE ALL ON FUNCTION public.is_unrestricted_merchant(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_unrestricted_merchant(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_unrestricted_merchant(text) TO service_role;

-- INSERT admin wallets (UNCOMMENTED with real addresses)
INSERT INTO public.platform_merchant_admin_wallets (wallet_address, note) VALUES
  ('0x5cc0aa9ed773f413f81f78a62f2e94109ce26205', 'platform admin 1'),
  ('0x40a8cdd6a10ec1a8cb3dfb2834675e7a2cf4ad8b', 'platform admin 2')
ON CONFLICT (wallet_address) DO NOTHING;

-- Grandfather: Growth 90d for existing merchants (excludes admins + those with active subs)
DO $$
DECLARE
  v_growth_id uuid;
  v_now timestamptz := now();
  v_expires timestamptz := v_now + interval '90 days';
BEGIN
  SELECT id INTO v_growth_id FROM public.merchant_plans WHERE slug = 'growth' AND is_active = true LIMIT 1;
  IF v_growth_id IS NULL THEN
    RAISE EXCEPTION 'merchant_plans.slug=growth missing';
  END IF;

  INSERT INTO public.merchant_plan_subscriptions (
    owner_address, plan_id, status, amount_usdc, transaction_hash, paid_at, expires_at
  )
  SELECT
    lower(trim(mp.merchant_address)),
    v_growth_id,
    'active',
    0,
    'grandfather_growth_90d',
    v_now,
    v_expires
  FROM public.merchant_profiles mp
  WHERE NOT public.is_unrestricted_merchant(mp.merchant_address)
    AND NOT EXISTS (
      SELECT 1
      FROM public.merchant_plan_subscriptions existing
      WHERE lower(existing.owner_address) = lower(trim(mp.merchant_address))
        AND existing.status = 'active'
    );

  UPDATE public.merchant_profiles mp
  SET merchant_plan_id = v_growth_id
  WHERE NOT public.is_unrestricted_merchant(mp.merchant_address)
    AND lower(trim(mp.merchant_address)) IN (
      SELECT lower(owner_address)
      FROM public.merchant_plan_subscriptions
      WHERE plan_id = v_growth_id
        AND transaction_hash = 'grandfather_growth_90d'
        AND paid_at >= v_now - interval '2 minutes'
    );
END $$;