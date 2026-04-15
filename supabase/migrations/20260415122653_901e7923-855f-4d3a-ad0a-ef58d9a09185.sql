-- Admins can delete any agent report
CREATE POLICY "Admins can delete agent reports"
ON public.agent_reports
FOR DELETE
TO authenticated
USING (is_admin());

-- Owners can delete their own agent reports
CREATE POLICY "Owners can delete own agent reports"
ON public.agent_reports
FOR DELETE
TO authenticated
USING (owner_address = (
  SELECT profiles.wallet_address
  FROM profiles
  WHERE profiles.user_id = auth.uid()
));