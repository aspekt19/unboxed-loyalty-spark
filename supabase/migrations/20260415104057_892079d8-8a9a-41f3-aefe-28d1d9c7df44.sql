-- Remove DELETE policies on agent_reports to prevent any deletion
DROP POLICY IF EXISTS "Admins can delete agent reports" ON public.agent_reports;
DROP POLICY IF EXISTS "Owners can delete own agent reports" ON public.agent_reports;