-- Enterprise plan advertises unlimited agents everywhere (pricing page, agent.json,
-- MONETIZATION_AND_PRICING.md). Seat limits are enforced server-side since 2026-08;
-- NULL max_agents means unlimited in agent-plan-limits.ts.

UPDATE public.agent_plans
SET max_agents = NULL, updated_at = now()
WHERE slug = 'enterprise';
