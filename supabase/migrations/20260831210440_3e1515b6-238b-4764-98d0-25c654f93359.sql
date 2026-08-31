ALTER TABLE public.agent_plans ALTER COLUMN max_agents DROP NOT NULL;
UPDATE public.agent_plans
SET max_agents = NULL, updated_at = now()
WHERE slug = 'enterprise';