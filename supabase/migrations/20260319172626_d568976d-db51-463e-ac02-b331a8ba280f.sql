-- Fix: Remove overly permissive 'System can manage referrals' policy
-- System writes should use service role key in edge functions instead
DROP POLICY IF EXISTS "System can manage referrals" ON public.referrals;