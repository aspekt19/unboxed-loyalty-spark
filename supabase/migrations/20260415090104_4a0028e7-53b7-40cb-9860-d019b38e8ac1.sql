-- Allow admins to update agent reports (change status)
CREATE POLICY "Admins can update agent reports"
ON public.agent_reports
FOR UPDATE
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

-- Allow owners to update their own reports
CREATE POLICY "Owners can update own agent reports"
ON public.agent_reports
FOR UPDATE
TO authenticated
USING (owner_address = (SELECT wallet_address FROM profiles WHERE user_id = auth.uid()))
WITH CHECK (owner_address = (SELECT wallet_address FROM profiles WHERE user_id = auth.uid()));