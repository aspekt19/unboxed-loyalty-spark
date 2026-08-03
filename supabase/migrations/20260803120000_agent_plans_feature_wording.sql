-- Align agent_plans.features wording with docs/business/MONETIZATION_AND_PRICING.md.
--
-- Two discrepancies fixed:
--   1. Enterprise features said "Up to 100 agents" while every public surface
--      (agent.json, llms.txt, README, pricing page) says unlimited.
--      `max_agents` is not enforced by any Edge Function today, so the text was
--      the only place the 100 ceiling was ever shown to a user.
--   2. "Unlimited minting" read as "minting is free". It means no monthly token
--      cap — the per-mint protocol fee still applies, charged in the merchant's
--      own loyalty tokens (see MONETIZATION_AND_PRICING.md §3.1).

UPDATE public.agent_plans
SET
  features = '["1 agent", "200 API calls/month", "1,000 tokens mint limit", "1.25% mint fee (paid in your loyalty tokens)", "Basic support"]'::jsonb,
  updated_at = now()
WHERE slug = 'free';

UPDATE public.agent_plans
SET
  features = '["Up to 5 agents", "10,000 API calls/month", "No monthly mint cap", "0.5% mint fee (paid in your loyalty tokens)", "Priority support", "CRM analytics", "Automation rules"]'::jsonb,
  updated_at = now()
WHERE slug = 'pro';

UPDATE public.agent_plans
SET
  features = '["Unlimited agents", "Unlimited API calls", "No monthly mint cap", "0.25% mint fee (paid in your loyalty tokens)", "Dedicated support", "Custom integrations", "Multi-chain support", "SLA guarantee"]'::jsonb,
  updated_at = now()
WHERE slug = 'enterprise';
