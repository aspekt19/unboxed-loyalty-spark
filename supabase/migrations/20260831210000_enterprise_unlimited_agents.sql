-- Enterprise plan advertises unlimited agents everywhere (pricing page, agent.json,
-- MONETIZATION_AND_PRICING.md). Seat limits are enforced server-side since 2026-08;
-- NULL max_agents means unlimited in agent-plan-limits.ts.

ALTER TABLE public.agent_plans
  ALTER COLUMN max_agents DROP NOT NULL;

UPDATE public.agent_plans
SET max_agents = NULL, updated_at = now()
WHERE slug = 'enterprise';
