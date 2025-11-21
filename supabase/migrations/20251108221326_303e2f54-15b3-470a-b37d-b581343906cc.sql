-- Таблица настроек реферальной программы
CREATE TABLE IF NOT EXISTS public.referral_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_address TEXT NOT NULL UNIQUE,
  merchant_address TEXT NOT NULL,
  referrer_bonus NUMERIC DEFAULT 0 CHECK (referrer_bonus >= 0),
  referee_bonus NUMERIC DEFAULT 0 CHECK (referee_bonus >= 0),
  is_active BOOLEAN DEFAULT TRUE,
  min_purchase_required NUMERIC DEFAULT 0,
  max_referrals_per_user INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Включаем RLS
ALTER TABLE public.referral_programs ENABLE ROW LEVEL SECURITY;

-- Все могут видеть активные реферальные программы
CREATE POLICY "Anyone can view active referral programs"
ON public.referral_programs
FOR SELECT
USING (is_active = true);

-- Мерчанты могут управлять своими программами
CREATE POLICY "Merchants can manage own referral programs"
ON public.referral_programs
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
CREATE TRIGGER update_referral_programs_updated_at
BEFORE UPDATE ON public.referral_programs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Таблица рефералов
CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_address TEXT NOT NULL,
  merchant_address TEXT NOT NULL,
  referrer_address TEXT NOT NULL,
  referee_address TEXT NOT NULL,
  referral_code TEXT NOT NULL,
  bonus_claimed BOOLEAN DEFAULT FALSE,
  referrer_bonus_amount NUMERIC DEFAULT 0,
  referee_bonus_amount NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  claimed_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(token_address, referee_address)
);

-- Включаем RLS
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- Клиенты могут видеть свои рефералы (как referrer)
CREATE POLICY "Users can view own referrals"
ON public.referrals
FOR SELECT
TO authenticated
USING (
  referrer_address = (
    SELECT wallet_address 
    FROM profiles 
    WHERE user_id = auth.uid()
  )
);

-- Мерчанты могут видеть все рефералы своих программ
CREATE POLICY "Merchants can view program referrals"
ON public.referrals
FOR SELECT
TO authenticated
USING (
  merchant_address = (
    SELECT wallet_address 
    FROM profiles 
    WHERE user_id = auth.uid()
  )
);

-- Система может создавать и обновлять рефералы
CREATE POLICY "System can manage referrals"
ON public.referrals
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Таблица источников трафика
CREATE TABLE IF NOT EXISTS public.traffic_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_address TEXT NOT NULL,
  token_address TEXT NOT NULL,
  merchant_address TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('organic', 'referral', 'social', 'qr_code', 'web', 'direct', 'email', 'other')),
  referral_code TEXT,
  campaign_id UUID REFERENCES marketing_campaigns(id),
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(customer_address, token_address)
);

-- Включаем RLS
ALTER TABLE public.traffic_sources ENABLE ROW LEVEL SECURITY;

-- Клиенты могут видеть свои источники
CREATE POLICY "Customers can view own traffic sources"
ON public.traffic_sources
FOR SELECT
TO authenticated
USING (
  customer_address = (
    SELECT wallet_address 
    FROM profiles 
    WHERE user_id = auth.uid()
  )
);

-- Мерчанты могут видеть источники своих клиентов
CREATE POLICY "Merchants can view customer traffic sources"
ON public.traffic_sources
FOR SELECT
TO authenticated
USING (
  merchant_address = (
    SELECT wallet_address 
    FROM profiles 
    WHERE user_id = auth.uid()
  )
);

-- Система может создавать источники
CREATE POLICY "System can create traffic sources"
ON public.traffic_sources
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Функция для генерации уникального реферального кода
CREATE OR REPLACE FUNCTION public.generate_referral_code(
  p_token_address TEXT,
  p_referrer_address TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_code TEXT;
  v_exists BOOLEAN;
BEGIN
  LOOP
    -- Генерируем 6-символьный код (буквы и цифры)
    v_code := upper(substring(md5(random()::text || p_referrer_address || now()::text) from 1 for 6));
    
    -- Проверяем уникальность
    SELECT EXISTS(
      SELECT 1 FROM referrals 
      WHERE referral_code = v_code 
        AND token_address = p_token_address
    ) INTO v_exists;
    
    EXIT WHEN NOT v_exists;
  END LOOP;
  
  RETURN v_code;
END;
$$;

-- Функция для обработки реферала и начисления бонусов
CREATE OR REPLACE FUNCTION public.process_referral(
  p_token_address TEXT,
  p_referee_address TEXT,
  p_referral_code TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referrer_address TEXT;
  v_merchant_address TEXT;
  v_referrer_bonus NUMERIC;
  v_referee_bonus NUMERIC;
  v_is_active BOOLEAN;
  v_existing_referral UUID;
BEGIN
  -- Проверяем, нет ли уже реферала для этого пользователя
  SELECT id INTO v_existing_referral
  FROM referrals
  WHERE token_address = p_token_address
    AND referee_address = p_referee_address;
    
  IF v_existing_referral IS NOT NULL THEN
    RETURN FALSE; -- Уже есть реферал
  END IF;

  -- Находим referrer по коду
  SELECT referrer_address INTO v_referrer_address
  FROM referrals
  WHERE referral_code = p_referral_code
    AND token_address = p_token_address
  LIMIT 1;
  
  -- Если код не найден в существующих рефералах, возможно это первое использование
  -- Генерируем новую запись
  IF v_referrer_address IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Получаем настройки реферальной программы
  SELECT 
    merchant_address,
    referrer_bonus,
    referee_bonus,
    is_active
  INTO 
    v_merchant_address,
    v_referrer_bonus,
    v_referee_bonus,
    v_is_active
  FROM referral_programs
  WHERE token_address = p_token_address;
  
  IF NOT v_is_active THEN
    RETURN FALSE;
  END IF;
  
  -- Создаём запись реферала
  INSERT INTO referrals (
    token_address,
    merchant_address,
    referrer_address,
    referee_address,
    referral_code,
    referrer_bonus_amount,
    referee_bonus_amount,
    bonus_claimed,
    claimed_at
  ) VALUES (
    p_token_address,
    v_merchant_address,
    v_referrer_address,
    p_referee_address,
    p_referral_code,
    v_referrer_bonus,
    v_referee_bonus,
    TRUE,
    NOW()
  );
  
  -- Записываем источник трафика
  INSERT INTO traffic_sources (
    customer_address,
    token_address,
    merchant_address,
    source,
    referral_code
  ) VALUES (
    p_referee_address,
    p_token_address,
    v_merchant_address,
    'referral',
    p_referral_code
  )
  ON CONFLICT (customer_address, token_address) DO NOTHING;
  
  RETURN TRUE;
END;
$$;

-- Автоматическое создание реферальной программы для новых loyalty программ
CREATE OR REPLACE FUNCTION public.create_default_referral_program()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO referral_programs (
    token_address,
    merchant_address,
    referrer_bonus,
    referee_bonus,
    is_active,
    min_purchase_required
  ) VALUES (
    NEW.token_address,
    NEW.merchant_address,
    50,  -- 50 токенов бонус для реферера
    25,  -- 25 токенов бонус для приглашённого
    TRUE,
    0
  );
  
  RETURN NEW;
END;
$$;

-- Триггер для автоматического создания реферальной программы
CREATE TRIGGER create_default_referral_program_trigger
AFTER INSERT ON public.loyalty_programs
FOR EACH ROW
EXECUTE FUNCTION public.create_default_referral_program();