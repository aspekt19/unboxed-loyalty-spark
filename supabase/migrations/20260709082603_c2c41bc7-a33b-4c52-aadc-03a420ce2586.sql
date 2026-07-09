-- Restrict authenticated INSERTs on plan subscription tables to unverified 'pending' rows.
-- Activation (status='active'/'trialing', paid_at, transaction_hash) must go through
-- service_role after real payment verification or the SECURITY DEFINER trial helpers.

DROP POLICY IF EXISTS "Owners can insert own subscriptions" ON public.agent_plan_subscriptions;
CREATE POLICY "Owners can insert pending own subscriptions"
  ON public.agent_plan_subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    lower(owner_address) = lower(COALESCE(
      (SELECT wallet_address FROM public.profiles WHERE user_id = auth.uid() LIMIT 1),
      ''
    ))
    AND status = 'pending'
    AND is_trial = false
    AND paid_at IS NULL
    AND transaction_hash IS NULL
  );

-- UPDATE by owners must not let them self-activate either.
DROP POLICY IF EXISTS "Owners can update own subscriptions" ON public.agent_plan_subscriptions;

DROP POLICY IF EXISTS "Owners can insert own merchant subs" ON public.merchant_plan_subscriptions;
CREATE POLICY "Owners can insert pending own merchant subs"
  ON public.merchant_plan_subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    lower(owner_address) = lower(COALESCE(
      (SELECT wallet_address FROM public.profiles WHERE user_id = auth.uid() LIMIT 1),
      ''
    ))
    AND status = 'pending'
    AND is_trial = false
    AND paid_at IS NULL
    AND transaction_hash IS NULL
  );

DROP POLICY IF EXISTS "Owners can update own merchant subs" ON public.merchant_plan_subscriptions;