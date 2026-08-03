DROP POLICY IF EXISTS "Owners can view own fees" ON public.agent_fee_log;
CREATE POLICY "Owners can view own fees" ON public.agent_fee_log
FOR SELECT TO authenticated
USING (agent_id IN (
  SELECT ar.id FROM public.agent_registry ar
  WHERE lower(ar.owner_address) = lower(COALESCE((
    SELECT p.wallet_address FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1), ''))
));

DROP POLICY IF EXISTS "Owners can view own subscriptions" ON public.agent_plan_subscriptions;
CREATE POLICY "Owners can view own subscriptions" ON public.agent_plan_subscriptions
FOR SELECT TO authenticated
USING (lower(owner_address) = lower(COALESCE((
  SELECT p.wallet_address FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1), '')));

DROP POLICY IF EXISTS "Owners can manage own agents" ON public.agent_registry;
CREATE POLICY "Owners can manage own agents" ON public.agent_registry
FOR ALL TO authenticated
USING (lower(owner_address) = lower(COALESCE((
  SELECT p.wallet_address FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1), '')))
WITH CHECK (lower(owner_address) = lower(COALESCE((
  SELECT p.wallet_address FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1), '')));

DROP POLICY IF EXISTS "Customers can insert own profile" ON public.customer_profiles;
CREATE POLICY "Customers can insert own profile" ON public.customer_profiles
FOR INSERT TO authenticated
WITH CHECK (lower(wallet_address) = lower(COALESCE((
  SELECT p.wallet_address FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1), '')));

DROP POLICY IF EXISTS "Customers can view own profile" ON public.customer_profiles;
CREATE POLICY "Customers can view own profile" ON public.customer_profiles
FOR SELECT TO authenticated
USING (lower(wallet_address) = lower(COALESCE((
  SELECT p.wallet_address FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1), '')));

DROP POLICY IF EXISTS "Merchants can view customer transactions" ON public.customer_transactions;
CREATE POLICY "Merchants can view customer transactions" ON public.customer_transactions
FOR SELECT TO authenticated
USING (lower(merchant_address) = lower(COALESCE((
  SELECT p.wallet_address FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1), '')));

DROP POLICY IF EXISTS "Merchants can create own profile" ON public.merchant_profiles;
CREATE POLICY "Merchants can create own profile" ON public.merchant_profiles
FOR INSERT TO authenticated
WITH CHECK (lower(merchant_address) = lower(COALESCE((
  SELECT p.wallet_address FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1), '')));

DROP POLICY IF EXISTS "Merchants can delete own profile" ON public.merchant_profiles;
CREATE POLICY "Merchants can delete own profile" ON public.merchant_profiles
FOR DELETE TO authenticated
USING (lower(merchant_address) = lower(COALESCE((
  SELECT p.wallet_address FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1), '')));

DROP POLICY IF EXISTS "Merchants can update own profile" ON public.merchant_profiles;
CREATE POLICY "Merchants can update own profile" ON public.merchant_profiles
FOR UPDATE TO authenticated
USING (lower(merchant_address) = lower(COALESCE((
  SELECT p.wallet_address FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1), '')))
WITH CHECK (lower(merchant_address) = lower(COALESCE((
  SELECT p.wallet_address FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1), '')));

DROP POLICY IF EXISTS "Merchants can manage own referral programs" ON public.referral_programs;
CREATE POLICY "Merchants can manage own referral programs" ON public.referral_programs
FOR ALL TO authenticated
USING (lower(merchant_address) = lower(COALESCE((
  SELECT p.wallet_address FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1), '')))
WITH CHECK (lower(merchant_address) = lower(COALESCE((
  SELECT p.wallet_address FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1), '')));

DROP POLICY IF EXISTS "Customers can view own traffic sources" ON public.traffic_sources;
CREATE POLICY "Customers can view own traffic sources" ON public.traffic_sources
FOR SELECT TO authenticated
USING (public.is_current_user_linked_wallet(customer_address));

DROP POLICY IF EXISTS "Merchants can view customer traffic sources" ON public.traffic_sources;
CREATE POLICY "Merchants can view customer traffic sources" ON public.traffic_sources
FOR SELECT TO authenticated
USING (lower(merchant_address) = lower(COALESCE((
  SELECT p.wallet_address FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1), '')));