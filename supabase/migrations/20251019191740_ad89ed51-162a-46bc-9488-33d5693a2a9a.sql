-- Создаем таблицу для программ лояльности
CREATE TABLE public.loyalty_programs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  token_address TEXT NOT NULL UNIQUE,
  merchant_address TEXT NOT NULL,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  expiration_date TIMESTAMP WITH TIME ZONE NOT NULL,
  expiration_warning_sent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expiring_soon', 'expired'))
);

-- Enable RLS
ALTER TABLE public.loyalty_programs ENABLE ROW LEVEL SECURITY;

-- Политики доступа
-- Все могут видеть активные программы
CREATE POLICY "Anyone can view active programs"
ON public.loyalty_programs
FOR SELECT
USING (status = 'active' OR status = 'expiring_soon');

-- Мерчанты могут создавать свои программы
CREATE POLICY "Merchants can create programs"
ON public.loyalty_programs
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL AND 
  merchant_address = (SELECT wallet_address FROM profiles WHERE user_id = auth.uid())
);

-- Мерчанты могут обновлять свои программы
CREATE POLICY "Merchants can update own programs"
ON public.loyalty_programs
FOR UPDATE
USING (merchant_address = (SELECT wallet_address FROM profiles WHERE user_id = auth.uid()));

-- Мерчанты могут удалять свои программы
CREATE POLICY "Merchants can delete own programs"
ON public.loyalty_programs
FOR DELETE
USING (merchant_address = (SELECT wallet_address FROM profiles WHERE user_id = auth.uid()));

-- Создаем индексы для производительности
CREATE INDEX idx_loyalty_programs_merchant ON public.loyalty_programs(merchant_address);
CREATE INDEX idx_loyalty_programs_token ON public.loyalty_programs(token_address);
CREATE INDEX idx_loyalty_programs_status ON public.loyalty_programs(status);
CREATE INDEX idx_loyalty_programs_expiration ON public.loyalty_programs(expiration_date);

-- Триггер для обновления updated_at
CREATE TRIGGER update_loyalty_programs_updated_at
BEFORE UPDATE ON public.loyalty_programs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Функция для проверки и обновления статуса программ
CREATE OR REPLACE FUNCTION check_program_expiration()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Помечаем программы, которые истекают в течение суток
  UPDATE loyalty_programs
  SET status = 'expiring_soon'
  WHERE status = 'active'
    AND expiration_date <= (NOW() + INTERVAL '24 hours')
    AND expiration_date > NOW();

  -- Помечаем истекшие программы
  UPDATE loyalty_programs
  SET status = 'expired'
  WHERE status != 'expired'
    AND expiration_date <= NOW();
END;
$$;

-- Включаем realtime для таблицы
ALTER PUBLICATION supabase_realtime ADD TABLE public.loyalty_programs;