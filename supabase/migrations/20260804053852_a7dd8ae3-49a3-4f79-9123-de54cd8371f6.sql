DROP POLICY IF EXISTS "Owners can view own agent wallets" ON public.agent_wallets;
CREATE POLICY "Owners can view own agent wallets"
ON public.agent_wallets
FOR SELECT
TO authenticated
USING (
  agent_id IN (
    SELECT ar.id FROM public.agent_registry ar
    WHERE lower(ar.owner_address) = lower(COALESCE((
      SELECT p.wallet_address FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1
    ), ''))
  )
);

DROP POLICY IF EXISTS "Owners can view own merchant subs" ON public.merchant_plan_subscriptions;
CREATE POLICY "Owners can view own merchant subs"
ON public.merchant_plan_subscriptions
FOR SELECT
TO authenticated
USING (
  lower(owner_address) = lower(COALESCE((
    SELECT p.wallet_address FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1
  ), ''))
);