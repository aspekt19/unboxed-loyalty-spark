DROP POLICY IF EXISTS "Owners can view agent activity" ON public.agent_activity_log;
CREATE POLICY "Owners can view agent activity"
ON public.agent_activity_log
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.agent_registry ar
    JOIN public.profiles p ON p.user_id = auth.uid()
    WHERE ar.id = agent_activity_log.agent_id
      AND lower(ar.owner_address) = lower(p.wallet_address)
  )
);

DROP POLICY IF EXISTS "Owners can view own agent reports" ON public.agent_reports;
CREATE POLICY "Owners can view own agent reports"
ON public.agent_reports
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND lower(p.wallet_address) = lower(agent_reports.owner_address)
  )
);

DROP POLICY IF EXISTS "Owners can update own agent reports" ON public.agent_reports;
CREATE POLICY "Owners can update own agent reports"
ON public.agent_reports
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND lower(p.wallet_address) = lower(agent_reports.owner_address)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND lower(p.wallet_address) = lower(agent_reports.owner_address)
  )
);

DROP POLICY IF EXISTS "Owners can delete own agent reports" ON public.agent_reports;
CREATE POLICY "Owners can delete own agent reports"
ON public.agent_reports
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND lower(p.wallet_address) = lower(agent_reports.owner_address)
  )
);