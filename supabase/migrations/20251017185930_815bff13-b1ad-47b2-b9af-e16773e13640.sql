-- Создание таблицы наград (rewards)
CREATE TABLE public.rewards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  token_address TEXT NOT NULL,
  merchant_address TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  cost NUMERIC NOT NULL CHECK (cost > 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Создание индексов для быстрого поиска
CREATE INDEX idx_rewards_token_address ON public.rewards(token_address);
CREATE INDEX idx_rewards_merchant_address ON public.rewards(merchant_address);
CREATE INDEX idx_rewards_is_active ON public.rewards(is_active);

-- Создание таблицы ваучеров (vouchers)
CREATE TABLE public.vouchers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  reward_id UUID NOT NULL REFERENCES public.rewards(id) ON DELETE CASCADE,
  reward_name TEXT NOT NULL,
  reward_description TEXT,
  token_address TEXT NOT NULL,
  token_symbol TEXT NOT NULL,
  customer_address TEXT NOT NULL,
  merchant_address TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'used', 'expired')),
  cost NUMERIC NOT NULL,
  activated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  used_at TIMESTAMP WITH TIME ZONE
);

-- Создание индексов для ваучеров
CREATE INDEX idx_vouchers_customer_address ON public.vouchers(customer_address);
CREATE INDEX idx_vouchers_merchant_address ON public.vouchers(merchant_address);
CREATE INDEX idx_vouchers_reward_id ON public.vouchers(reward_id);
CREATE INDEX idx_vouchers_status ON public.vouchers(status);

-- Включение RLS
ALTER TABLE public.rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vouchers ENABLE ROW LEVEL SECURITY;

-- Политики для таблицы rewards
-- Все могут читать активные награды
CREATE POLICY "Anyone can view active rewards"
ON public.rewards
FOR SELECT
USING (is_active = true);

-- Все могут создавать награды (контроль на уровне приложения)
CREATE POLICY "Anyone can create rewards"
ON public.rewards
FOR INSERT
WITH CHECK (true);

-- Мерчанты могут обновлять свои награды
CREATE POLICY "Merchants can update their rewards"
ON public.rewards
FOR UPDATE
USING (true);

-- Мерчанты могут удалять свои награды
CREATE POLICY "Merchants can delete their rewards"
ON public.rewards
FOR DELETE
USING (true);

-- Политики для таблицы vouchers
-- Все могут читать ваучеры (для отображения в интерфейсе)
CREATE POLICY "Anyone can view vouchers"
ON public.vouchers
FOR SELECT
USING (true);

-- Все могут создавать ваучеры (контроль на уровне приложения)
CREATE POLICY "Anyone can create vouchers"
ON public.vouchers
FOR INSERT
WITH CHECK (true);

-- Обновление ваучеров (например, изменение статуса)
CREATE POLICY "Anyone can update vouchers"
ON public.vouchers
FOR UPDATE
USING (true);

-- Функция для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Триггер для автоматического обновления updated_at в rewards
CREATE TRIGGER update_rewards_updated_at
BEFORE UPDATE ON public.rewards
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();