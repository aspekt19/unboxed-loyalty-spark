
-- Drop the permissive UPDATE policy that allows users to modify any column
DROP POLICY "Users can update own subscription" ON public.premium_subscriptions;

-- Create a restricted UPDATE policy that only allows updating non-sensitive fields
-- Subscription state changes (is_active, subscription_type, subscription_status, expires_at)
-- should only be done server-side via service role
CREATE POLICY "Users can update own subscription safely"
ON public.premium_subscriptions
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND is_active = (SELECT ps.is_active FROM premium_subscriptions ps WHERE ps.id = premium_subscriptions.id)
  AND subscription_type = (SELECT ps.subscription_type FROM premium_subscriptions ps WHERE ps.id = premium_subscriptions.id)
  AND subscription_status = (SELECT ps.subscription_status FROM premium_subscriptions ps WHERE ps.id = premium_subscriptions.id)
  AND expires_at IS NOT DISTINCT FROM (SELECT ps.expires_at FROM premium_subscriptions ps WHERE ps.id = premium_subscriptions.id)
  AND started_at IS NOT DISTINCT FROM (SELECT ps.started_at FROM premium_subscriptions ps WHERE ps.id = premium_subscriptions.id)
);
