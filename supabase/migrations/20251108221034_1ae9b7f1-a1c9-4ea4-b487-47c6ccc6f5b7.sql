-- Таблица для маркетинговых кампаний
CREATE TABLE IF NOT EXISTS public.marketing_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_address TEXT NOT NULL,
  token_address TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  target_segment TEXT CHECK (target_segment IN ('all', 'champions', 'loyal', 'at_risk', 'lost', 'new')),
  min_balance NUMERIC,
  max_balance NUMERIC,
  scheduled_at TIMESTAMP WITH TIME ZONE,
  sent_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sent', 'failed')),
  recipients_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Включаем RLS
ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;

-- Мерчанты могут управлять своими кампаниями
CREATE POLICY "Merchants can manage own campaigns"
ON public.marketing_campaigns
FOR ALL
TO authenticated
USING (
  merchant_address = (
    SELECT wallet_address 
    FROM profiles 
    WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  merchant_address = (
    SELECT wallet_address 
    FROM profiles 
    WHERE user_id = auth.uid()
  )
);

-- Триггер для автоматического обновления updated_at
CREATE TRIGGER update_marketing_campaigns_updated_at
BEFORE UPDATE ON public.marketing_campaigns
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Таблица для истории отправленных уведомлений
CREATE TABLE IF NOT EXISTS public.notification_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
  customer_address TEXT NOT NULL,
  customer_email TEXT,
  delivered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  opened_at TIMESTAMP WITH TIME ZONE,
  clicked BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'delivered' CHECK (status IN ('delivered', 'failed', 'bounced', 'opened', 'clicked')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Включаем RLS
ALTER TABLE public.notification_history ENABLE ROW LEVEL SECURITY;

-- Мерчанты могут видеть историю своих кампаний
CREATE POLICY "Merchants can view own notification history"
ON public.notification_history
FOR SELECT
TO authenticated
USING (
  campaign_id IN (
    SELECT id 
    FROM marketing_campaigns 
    WHERE merchant_address = (
      SELECT wallet_address 
      FROM profiles 
      WHERE user_id = auth.uid()
    )
  )
);

-- Система может вставлять записи
CREATE POLICY "System can insert notifications"
ON public.notification_history
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Клиенты могут обновлять статус своих уведомлений (открытие, клик)
CREATE POLICY "Customers can update own notifications"
ON public.notification_history
FOR UPDATE
TO authenticated
USING (
  customer_address = (
    SELECT wallet_address 
    FROM profiles 
    WHERE user_id = auth.uid()
  )
);

-- Таблица персонализированных акций
CREATE TABLE IF NOT EXISTS public.personalized_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_address TEXT NOT NULL,
  token_address TEXT NOT NULL,
  customer_address TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  discount_percentage NUMERIC,
  bonus_tokens NUMERIC,
  min_purchase NUMERIC,
  valid_from TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  valid_until TIMESTAMP WITH TIME ZONE NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  is_used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Включаем RLS
ALTER TABLE public.personalized_offers ENABLE ROW LEVEL SECURITY;

-- Мерчанты могут создавать и управлять акциями
CREATE POLICY "Merchants can manage own offers"
ON public.personalized_offers
FOR ALL
TO authenticated
USING (
  merchant_address = (
    SELECT wallet_address 
    FROM profiles 
    WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  merchant_address = (
    SELECT wallet_address 
    FROM profiles 
    WHERE user_id = auth.uid()
  )
);

-- Клиенты могут видеть свои акции
CREATE POLICY "Customers can view own offers"
ON public.personalized_offers
FOR SELECT
TO authenticated
USING (
  customer_address = (
    SELECT wallet_address 
    FROM profiles 
    WHERE user_id = auth.uid()
  ) AND is_active = true
);

-- Триггер для автоматического обновления updated_at
CREATE TRIGGER update_personalized_offers_updated_at
BEFORE UPDATE ON public.personalized_offers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Функция для получения списка клиентов по сегменту
CREATE OR REPLACE FUNCTION public.get_customers_by_segment(
  p_merchant_address TEXT,
  p_token_address TEXT,
  p_segment TEXT,
  p_min_balance NUMERIC DEFAULT NULL,
  p_max_balance NUMERIC DEFAULT NULL
)
RETURNS TABLE (
  customer_address TEXT,
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  balance NUMERIC,
  rfm_score TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    DISTINCT v.customer_address,
    cp.email,
    cp.first_name,
    cp.last_name,
    COALESCE(cts.current_balance, 0) as balance,
    COALESCE(cp.rfm_score, 'new') as rfm_score
  FROM vouchers v
  LEFT JOIN customer_profiles cp ON cp.wallet_address = v.customer_address
  LEFT JOIN customer_tier_status cts ON cts.customer_address = v.customer_address 
    AND cts.token_address = p_token_address
  WHERE v.merchant_address = p_merchant_address
    AND v.token_address = p_token_address
    AND (p_segment = 'all' OR COALESCE(cp.rfm_score, 'new') = p_segment)
    AND (p_min_balance IS NULL OR COALESCE(cts.current_balance, 0) >= p_min_balance)
    AND (p_max_balance IS NULL OR COALESCE(cts.current_balance, 0) <= p_max_balance);
END;
$$;