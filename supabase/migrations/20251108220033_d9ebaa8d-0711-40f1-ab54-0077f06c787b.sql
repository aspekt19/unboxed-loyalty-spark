-- Таблица для расширенных профилей клиентов
CREATE TABLE IF NOT EXISTS public.customer_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL UNIQUE,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  email TEXT,
  total_purchases NUMERIC DEFAULT 0,
  total_spent NUMERIC DEFAULT 0,
  last_purchase_date TIMESTAMP WITH TIME ZONE,
  rfm_score TEXT CHECK (rfm_score IN ('champions', 'loyal', 'at_risk', 'lost', 'new')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Включаем RLS
ALTER TABLE public.customer_profiles ENABLE ROW LEVEL SECURITY;

-- Политики доступа для customer_profiles
-- Клиенты могут видеть и обновлять свой профиль
CREATE POLICY "Customers can view own profile"
ON public.customer_profiles
FOR SELECT
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
WITH CHECK (
  wallet_address = (
    SELECT wallet_address 
    FROM profiles 
    WHERE user_id = auth.uid()
  )
);

-- Мерчанты могут видеть профили своих клиентов (тех, кто активировал их ваучеры)
CREATE POLICY "Merchants can view their customers"
ON public.customer_profiles
FOR SELECT
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

-- Триггер для автоматического обновления updated_at
CREATE TRIGGER update_customer_profiles_updated_at
BEFORE UPDATE ON public.customer_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- View для аналитики мерчанта
CREATE OR REPLACE VIEW public.merchant_analytics AS
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

-- Таблица для хранения истории транзакций клиентов (для RFM анализа)
CREATE TABLE IF NOT EXISTS public.customer_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_address TEXT NOT NULL,
  token_address TEXT NOT NULL,
  merchant_address TEXT NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('voucher_purchase', 'tokens_earned', 'tokens_spent')),
  amount NUMERIC NOT NULL,
  transaction_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  voucher_id UUID REFERENCES vouchers(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Включаем RLS для транзакций
ALTER TABLE public.customer_transactions ENABLE ROW LEVEL SECURITY;

-- Клиенты могут видеть свои транзакции
CREATE POLICY "Customers can view own transactions"
ON public.customer_transactions
FOR SELECT
USING (
  customer_address = (
    SELECT wallet_address 
    FROM profiles 
    WHERE user_id = auth.uid()
  )
);

-- Мерчанты могут видеть транзакции своих клиентов
CREATE POLICY "Merchants can view customer transactions"
ON public.customer_transactions
FOR SELECT
USING (
  merchant_address = (
    SELECT wallet_address 
    FROM profiles 
    WHERE user_id = auth.uid()
  )
);

-- Система может вставлять транзакции при активации ваучеров
CREATE POLICY "System can insert transactions"
ON public.customer_transactions
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Функция для автоматического обновления RFM score
CREATE OR REPLACE FUNCTION public.update_customer_rfm_score()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Обновляем RFM оценку для всех клиентов на основе их активности
  UPDATE customer_profiles cp
  SET 
    rfm_score = CASE
      -- Champions: покупали недавно, часто и много тратят
      WHEN cp.last_purchase_date > NOW() - INTERVAL '30 days' 
        AND cp.total_purchases >= 5 
        AND cp.total_spent >= 100 THEN 'champions'
      
      -- Loyal: покупают регулярно
      WHEN cp.last_purchase_date > NOW() - INTERVAL '60 days' 
        AND cp.total_purchases >= 3 THEN 'loyal'
      
      -- At Risk: были активны, но давно не покупали
      WHEN cp.last_purchase_date BETWEEN NOW() - INTERVAL '180 days' AND NOW() - INTERVAL '60 days'
        AND cp.total_purchases >= 2 THEN 'at_risk'
      
      -- Lost: давно не активны
      WHEN cp.last_purchase_date < NOW() - INTERVAL '180 days' THEN 'lost'
      
      -- New: новые клиенты
      ELSE 'new'
    END,
    updated_at = NOW()
  WHERE cp.last_purchase_date IS NOT NULL;
END;
$$;