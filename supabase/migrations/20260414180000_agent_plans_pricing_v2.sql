-- Pricing v2 — aligned with docs/business/MONETIZATION_AND_PRICING.md
-- Agent tiers: Free 200 calls / 1.25% | Pro $49 / 0.5% | Enterprise $129 / 0.25%

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
