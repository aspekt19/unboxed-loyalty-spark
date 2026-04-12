
-- 1. Fix customer_profiles: change merchant policy from public to authenticated
DROP POLICY IF EXISTS "Merchants can view masked customer data via view" ON public.customer_profiles;
CREATE POLICY "Merchants can view masked customer data via view"
  ON public.customer_profiles
  FOR SELECT
  TO authenticated
  USING (
    wallet_address = (
      SELECT profiles.wallet_address
      FROM profiles
      WHERE profiles.user_id = auth.uid()
    )
  );

-- 2. Add owner SELECT policy on agent_wallets
CREATE POLICY "Owners can view own agent wallets"
  ON public.agent_wallets
  FOR SELECT
  TO authenticated
  USING (
    agent_id IN (
      SELECT id FROM agent_registry
      WHERE owner_address = (
        SELECT wallet_address FROM profiles WHERE user_id = auth.uid()
      )
    )
  );

-- 3. Fix premium_subscriptions UPDATE: restrict all sensitive fields, not just status fields
DROP POLICY IF EXISTS "Users can update own subscription safely" ON public.premium_subscriptions;
CREATE POLICY "Users can update own subscription safely"
  ON public.premium_subscriptions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    -- Lock down all sensitive fields: they must remain unchanged
    AND is_active = (SELECT ps.is_active FROM premium_subscriptions ps WHERE ps.id = premium_subscriptions.id)
    AND subscription_type = (SELECT ps.subscription_type FROM premium_subscriptions ps WHERE ps.id = premium_subscriptions.id)
    AND subscription_status = (SELECT ps.subscription_status FROM premium_subscriptions ps WHERE ps.id = premium_subscriptions.id)
    AND NOT (expires_at IS DISTINCT FROM (SELECT ps.expires_at FROM premium_subscriptions ps WHERE ps.id = premium_subscriptions.id))
    AND NOT (started_at IS DISTINCT FROM (SELECT ps.started_at FROM premium_subscriptions ps WHERE ps.id = premium_subscriptions.id))
    AND NOT (wallet_address IS DISTINCT FROM (SELECT ps.wallet_address FROM premium_subscriptions ps WHERE ps.id = premium_subscriptions.id))
    AND NOT (plan_id IS DISTINCT FROM (SELECT ps.plan_id FROM premium_subscriptions ps WHERE ps.id = premium_subscriptions.id))
    AND NOT (stripe_customer_id IS DISTINCT FROM (SELECT ps.stripe_customer_id FROM premium_subscriptions ps WHERE ps.id = premium_subscriptions.id))
    AND NOT (stripe_subscription_id IS DISTINCT FROM (SELECT ps.stripe_subscription_id FROM premium_subscriptions ps WHERE ps.id = premium_subscriptions.id))
    AND NOT (monthly_price IS DISTINCT FROM (SELECT ps.monthly_price FROM premium_subscriptions ps WHERE ps.id = premium_subscriptions.id))
    AND NOT (currency IS DISTINCT FROM (SELECT ps.currency FROM premium_subscriptions ps WHERE ps.id = premium_subscriptions.id))
  );
