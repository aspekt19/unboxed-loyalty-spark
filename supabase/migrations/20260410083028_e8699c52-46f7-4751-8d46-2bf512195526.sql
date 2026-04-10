-- Allow owners to delete their own agent reports
CREATE POLICY "Owners can delete own agent reports"
ON public.agent_reports
FOR DELETE
TO authenticated
USING (owner_address = (
  SELECT profiles.wallet_address
  FROM profiles
  WHERE profiles.user_id = auth.uid()
));

-- Allow admins to delete any agent reports  
CREATE POLICY "Admins can delete agent reports"
ON public.agent_reports
FOR DELETE
TO authenticated
USING (public.is_admin());