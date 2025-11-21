-- Пересоздаем view без SECURITY DEFINER
DROP VIEW IF EXISTS public.merchant_analytics;

CREATE VIEW public.merchant_analytics AS
SELECT 
  lp.merchant_address,
  lp.token_address,
  lp.name as program_name,
  lp.symbol as token_symbol,
  COUNT(DISTINCT v.customer_address) as total_customers,
  COUNT(DISTINCT CASE WHEN v.activated_at > NOW() - INTERVAL '30 days' THEN v.customer_address END) as active_customers_30d,
  COUNT(DISTINCT CASE WHEN v.activated_at > NOW() - INTERVAL '7 days' THEN v.customer_address END) as active_customers_7d,
  COUNT(v.id) as total_vouchers_issued,
  COUNT(CASE WHEN v.status = 'used' THEN 1 END) as vouchers_redeemed,
  SUM(v.cost) as total_tokens_spent,
  AVG(v.cost) as avg_voucher_cost,
  COUNT(CASE WHEN v.activated_at > NOW() - INTERVAL '30 days' THEN 1 END) as vouchers_last_30d,
  lp.created_at as program_created_at
FROM loyalty_programs lp
LEFT JOIN vouchers v ON v.token_address = lp.token_address
GROUP BY lp.merchant_address, lp.token_address, lp.name, lp.symbol, lp.created_at;

-- Обновляем RLS политики для customer_profiles - требуем аутентификацию
DROP POLICY IF EXISTS "Customers can view own profile" ON public.customer_profiles;
DROP POLICY IF EXISTS "Customers can update own profile" ON public.customer_profiles;
DROP POLICY IF EXISTS "Customers can insert own profile" ON public.customer_profiles;
DROP POLICY IF EXISTS "Merchants can view their customers" ON public.customer_profiles;

CREATE POLICY "Customers can view own profile"
ON public.customer_profiles
FOR SELECT
TO authenticated
USING (
  wallet_address = (
    SELECT wallet_address 
    FROM profiles 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Customers can update own profile"
ON public.customer_profiles
FOR UPDATE
TO authenticated
USING (
  wallet_address = (
    SELECT wallet_address 
    FROM profiles 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Customers can insert own profile"
ON public.customer_profiles
FOR INSERT
TO authenticated
WITH CHECK (
  wallet_address = (
    SELECT wallet_address 
    FROM profiles 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Merchants can view their customers"
ON public.customer_profiles
FOR SELECT
TO authenticated
USING (
  wallet_address IN (
    SELECT DISTINCT customer_address
    FROM vouchers
    WHERE merchant_address = (
      SELECT wallet_address 
      FROM profiles 
      WHERE user_id = auth.uid()
    )
  )
);

-- Обновляем RLS политики для customer_transactions - требуем аутентификацию
DROP POLICY IF EXISTS "Customers can view own transactions" ON public.customer_transactions;
DROP POLICY IF EXISTS "Merchants can view customer transactions" ON public.customer_transactions;
DROP POLICY IF EXISTS "System can insert transactions" ON public.customer_transactions;

CREATE POLICY "Customers can view own transactions"
ON public.customer_transactions
FOR SELECT
TO authenticated
USING (
  customer_address = (
    SELECT wallet_address 
    FROM profiles 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Merchants can view customer transactions"
ON public.customer_transactions
FOR SELECT
TO authenticated
USING (
  merchant_address = (
    SELECT wallet_address 
    FROM profiles 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "System can insert transactions"
ON public.customer_transactions
FOR INSERT
TO authenticated
WITH CHECK (true);