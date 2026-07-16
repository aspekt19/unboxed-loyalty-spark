DROP POLICY IF EXISTS "Users can insert own subscription" ON public.premium_subscriptions;

CREATE POLICY "Users can insert own subscription safely"
ON public.premium_subscriptions
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND is_active = false
  AND (subscription_status IS NULL OR subscription_status IN ('inactive','pending'))
  AND (subscription_type IS NULL OR subscription_type <> 'premium')
  AND expires_at IS NULL
  AND started_at IS NULL
  AND stripe_customer_id IS NULL
  AND stripe_subscription_id IS NULL
);