
-- Add owner_address to agent_reports to link reports to merchant
ALTER TABLE public.agent_reports ADD COLUMN owner_address text;

-- Drop old permissive SELECT policy
DROP POLICY IF EXISTS "Authenticated users can read agent reports" ON public.agent_reports;

-- Owners can view their own agent reports
CREATE POLICY "Owners can view own agent reports"
ON public.agent_reports
FOR SELECT
TO authenticated
USING (
  owner_address = (
    SELECT profiles.wallet_address FROM profiles WHERE profiles.user_id = auth.uid()
  )
);

-- Admins can view all reports
CREATE POLICY "Admins can view all agent reports"
ON public.agent_reports
FOR SELECT
TO authenticated
USING (public.is_admin());

-- Service role full access
CREATE POLICY "Service role full access agent reports"
ON public.agent_reports
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
