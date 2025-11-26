-- Создаем таблицу для тарифных планов Premium
CREATE TABLE IF NOT EXISTS public.premium_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  duration_months INTEGER NOT NULL,
  price_usdc NUMERIC NOT NULL,
  price_eth NUMERIC NOT NULL,
  discount_percentage INTEGER DEFAULT 0,
  features JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Создаем таблицу для логирования активности Premium
CREATE TABLE IF NOT EXISTS public.premium_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL,
  activity_type TEXT NOT NULL,
  activity_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Создаем таблицу для уведомлений об истечении
CREATE TABLE IF NOT EXISTS public.premium_expiration_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL,
  subscription_id UUID NOT NULL REFERENCES public.premium_subscriptions(id),
  notification_type TEXT NOT NULL, -- 'warning_7d', 'warning_3d', 'expired'
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Включаем RLS
ALTER TABLE public.premium_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.premium_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.premium_expiration_notifications ENABLE ROW LEVEL SECURITY;

-- Политики для premium_plans
CREATE POLICY "Anyone can view active plans"
  ON public.premium_plans
  FOR SELECT
  USING (is_active = true);

CREATE POLICY "Only admins can manage plans"
  ON public.premium_plans
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- Политики для premium_activity_log
CREATE POLICY "Users can view own activity"
  ON public.premium_activity_log
  FOR SELECT
  USING (lower(wallet_address) = lower((SELECT wallet_address FROM profiles WHERE user_id = auth.uid())));

CREATE POLICY "System can insert activity"
  ON public.premium_activity_log
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can view all activity"
  ON public.premium_activity_log
  FOR SELECT
  USING (is_admin());

-- Политики для premium_expiration_notifications
CREATE POLICY "Users can view own notifications"
  ON public.premium_expiration_notifications
  FOR SELECT
  USING (lower(wallet_address) = lower((SELECT wallet_address FROM profiles WHERE user_id = auth.uid())));

CREATE POLICY "System can insert notifications"
  ON public.premium_expiration_notifications
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can view all notifications"
  ON public.premium_expiration_notifications
  FOR SELECT
  USING (is_admin());

-- Добавляем колонку plan_id в premium_subscriptions
ALTER TABLE public.premium_subscriptions
ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES public.premium_plans(id);

-- Вставляем стандартные тарифные планы
INSERT INTO public.premium_plans (name, duration_months, price_usdc, price_eth, discount_percentage, features) VALUES
  ('Месяц', 1, 10, 0.004, 0, '["Доступ к Round-Up инвестициям", "Расширенная аналитика", "Приоритетная поддержка"]'::jsonb),
  ('3 месяца', 3, 27, 0.011, 10, '["Доступ к Round-Up инвестициям", "Расширенная аналитика", "Приоритетная поддержка", "Скидка 10%"]'::jsonb),
  ('Год', 12, 96, 0.038, 20, '["Доступ к Round-Up инвестициям", "Расширенная аналитика", "Приоритетная поддержка", "Скидка 20%", "Эксклюзивные стратегии"]'::jsonb)
ON CONFLICT DO NOTHING;

-- Функция для логирования активности
CREATE OR REPLACE FUNCTION log_premium_activity(
  p_wallet_address TEXT,
  p_activity_type TEXT,
  p_activity_data JSONB DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.premium_activity_log (wallet_address, activity_type, activity_data)
  VALUES (p_wallet_address, p_activity_type, p_activity_data);
END;
$$;

-- Функция для проверки истекающих подписок
CREATE OR REPLACE FUNCTION check_expiring_subscriptions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  sub_record RECORD;
  days_until_expiry INTEGER;
BEGIN
  -- Проверяем все активные подписки
  FOR sub_record IN 
    SELECT * FROM public.premium_subscriptions 
    WHERE is_active = true 
    AND subscription_status = 'active'
    AND expires_at IS NOT NULL
  LOOP
    days_until_expiry := EXTRACT(DAY FROM (sub_record.expires_at - now()));
    
    -- Уведомление за 7 дней
    IF days_until_expiry <= 7 AND days_until_expiry > 3 THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.premium_expiration_notifications
        WHERE subscription_id = sub_record.id
        AND notification_type = 'warning_7d'
      ) THEN
        INSERT INTO public.premium_expiration_notifications 
          (wallet_address, subscription_id, notification_type)
        VALUES 
          (sub_record.wallet_address, sub_record.id, 'warning_7d');
      END IF;
    END IF;
    
    -- Уведомление за 3 дня
    IF days_until_expiry <= 3 AND days_until_expiry > 0 THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.premium_expiration_notifications
        WHERE subscription_id = sub_record.id
        AND notification_type = 'warning_3d'
      ) THEN
        INSERT INTO public.premium_expiration_notifications 
          (wallet_address, subscription_id, notification_type)
        VALUES 
          (sub_record.wallet_address, sub_record.id, 'warning_3d');
      END IF;
    END IF;
    
    -- Уведомление об истечении
    IF days_until_expiry <= 0 THEN
      UPDATE public.premium_subscriptions
      SET is_active = false, subscription_status = 'expired'
      WHERE id = sub_record.id;
      
      IF NOT EXISTS (
        SELECT 1 FROM public.premium_expiration_notifications
        WHERE subscription_id = sub_record.id
        AND notification_type = 'expired'
      ) THEN
        INSERT INTO public.premium_expiration_notifications 
          (wallet_address, subscription_id, notification_type)
        VALUES 
          (sub_record.wallet_address, sub_record.id, 'expired');
      END IF;
    END IF;
  END LOOP;
END;
$$;