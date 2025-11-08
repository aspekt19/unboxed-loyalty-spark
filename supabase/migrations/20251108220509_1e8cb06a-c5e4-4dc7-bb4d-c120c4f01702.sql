-- Таблица для уровней программ лояльности
CREATE TABLE IF NOT EXISTS public.customer_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_address TEXT NOT NULL,
  tier_name TEXT NOT NULL,
  tier_level INTEGER NOT NULL CHECK (tier_level >= 0),
  min_tokens NUMERIC NOT NULL CHECK (min_tokens >= 0),
  cashback_multiplier NUMERIC DEFAULT 1.0 CHECK (cashback_multiplier >= 0),
  welcome_bonus NUMERIC DEFAULT 0 CHECK (welcome_bonus >= 0),
  perks JSONB DEFAULT '[]'::jsonb,
  badge_color TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(token_address, tier_level)
);

-- Включаем RLS
ALTER TABLE public.customer_tiers ENABLE ROW LEVEL SECURITY;

-- Политики доступа для customer_tiers
-- Все могут видеть уровни активных программ
CREATE POLICY "Anyone can view tiers for active programs"
ON public.customer_tiers
FOR SELECT
USING (
  token_address IN (
    SELECT token_address 
    FROM loyalty_programs 
    WHERE status IN ('active', 'expiring_soon', 'paused')
  )
);

-- Мерчанты могут создавать и редактировать уровни своих программ
CREATE POLICY "Merchants can manage their program tiers"
ON public.customer_tiers
FOR ALL
TO authenticated
USING (
  token_address IN (
    SELECT token_address
    FROM loyalty_programs
    WHERE merchant_address = (
      SELECT wallet_address 
      FROM profiles 
      WHERE user_id = auth.uid()
    )
  )
)
WITH CHECK (
  token_address IN (
    SELECT token_address
    FROM loyalty_programs
    WHERE merchant_address = (
      SELECT wallet_address 
      FROM profiles 
      WHERE user_id = auth.uid()
    )
  )
);

-- Триггер для автоматического обновления updated_at
CREATE TRIGGER update_customer_tiers_updated_at
BEFORE UPDATE ON public.customer_tiers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Таблица для отслеживания уровня клиента в каждой программе
CREATE TABLE IF NOT EXISTS public.customer_tier_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_address TEXT NOT NULL,
  token_address TEXT NOT NULL,
  current_tier_id UUID REFERENCES customer_tiers(id) ON DELETE SET NULL,
  current_balance NUMERIC DEFAULT 0,
  tokens_earned_total NUMERIC DEFAULT 0,
  tier_achieved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(customer_address, token_address)
);

-- Включаем RLS
ALTER TABLE public.customer_tier_status ENABLE ROW LEVEL SECURITY;

-- Клиенты могут видеть свои статусы уровней
CREATE POLICY "Customers can view own tier status"
ON public.customer_tier_status
FOR SELECT
TO authenticated
USING (
  customer_address = (
    SELECT wallet_address 
    FROM profiles 
    WHERE user_id = auth.uid()
  )
);

-- Мерчанты могут видеть статусы своих клиентов
CREATE POLICY "Merchants can view customer tier status"
ON public.customer_tier_status
FOR SELECT
TO authenticated
USING (
  token_address IN (
    SELECT token_address
    FROM loyalty_programs
    WHERE merchant_address = (
      SELECT wallet_address 
      FROM profiles 
      WHERE user_id = auth.uid()
    )
  )
);

-- Система может обновлять статусы
CREATE POLICY "System can update tier status"
ON public.customer_tier_status
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Триггер для автоматического обновления updated_at
CREATE TRIGGER update_customer_tier_status_updated_at
BEFORE UPDATE ON public.customer_tier_status
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Функция для автоматического определения и обновления уровня клиента
CREATE OR REPLACE FUNCTION public.update_customer_tier(
  p_customer_address TEXT,
  p_token_address TEXT,
  p_current_balance NUMERIC
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier_id UUID;
  v_existing_status_id UUID;
BEGIN
  -- Находим подходящий уровень на основе баланса
  SELECT id INTO v_tier_id
  FROM customer_tiers
  WHERE token_address = p_token_address
    AND min_tokens <= p_current_balance
  ORDER BY min_tokens DESC
  LIMIT 1;

  -- Проверяем, есть ли уже запись для этого клиента
  SELECT id INTO v_existing_status_id
  FROM customer_tier_status
  WHERE customer_address = p_customer_address
    AND token_address = p_token_address;

  IF v_existing_status_id IS NOT NULL THEN
    -- Обновляем существующую запись
    UPDATE customer_tier_status
    SET 
      current_tier_id = v_tier_id,
      current_balance = p_current_balance,
      tier_achieved_at = CASE 
        WHEN current_tier_id != v_tier_id OR current_tier_id IS NULL 
        THEN NOW() 
        ELSE tier_achieved_at 
      END,
      last_calculated_at = NOW(),
      updated_at = NOW()
    WHERE id = v_existing_status_id;
  ELSE
    -- Создаём новую запись
    INSERT INTO customer_tier_status (
      customer_address,
      token_address,
      current_tier_id,
      current_balance,
      tokens_earned_total,
      tier_achieved_at,
      last_calculated_at
    ) VALUES (
      p_customer_address,
      p_token_address,
      v_tier_id,
      p_current_balance,
      p_current_balance,
      NOW(),
      NOW()
    );
  END IF;

  RETURN v_tier_id;
END;
$$;

-- Создаём стандартные уровни для каждой новой программы (триггер)
CREATE OR REPLACE FUNCTION public.create_default_tiers_for_program()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Bronze tier
  INSERT INTO customer_tiers (
    token_address,
    tier_name,
    tier_level,
    min_tokens,
    cashback_multiplier,
    welcome_bonus,
    badge_color,
    perks
  ) VALUES (
    NEW.token_address,
    'Bronze',
    1,
    0,
    1.0,
    10,
    '#CD7F32',
    '["Access to basic rewards", "1x cashback rate"]'::jsonb
  );

  -- Silver tier
  INSERT INTO customer_tiers (
    token_address,
    tier_name,
    tier_level,
    min_tokens,
    cashback_multiplier,
    welcome_bonus,
    badge_color,
    perks
  ) VALUES (
    NEW.token_address,
    'Silver',
    2,
    100,
    1.25,
    25,
    '#C0C0C0',
    '["Priority rewards access", "1.25x cashback rate", "Exclusive offers"]'::jsonb
  );

  -- Gold tier
  INSERT INTO customer_tiers (
    token_address,
    tier_name,
    tier_level,
    min_tokens,
    cashback_multiplier,
    welcome_bonus,
    badge_color,
    perks
  ) VALUES (
    NEW.token_address,
    'Gold',
    3,
    500,
    1.5,
    50,
    '#FFD700',
    '["Premium rewards", "1.5x cashback rate", "Birthday bonus", "Early access"]'::jsonb
  );

  -- Platinum tier
  INSERT INTO customer_tiers (
    token_address,
    tier_name,
    tier_level,
    min_tokens,
    cashback_multiplier,
    welcome_bonus,
    badge_color,
    perks
  ) VALUES (
    NEW.token_address,
    'Platinum',
    4,
    1000,
    2.0,
    100,
    '#E5E4E2',
    '["VIP rewards", "2x cashback rate", "Personal manager", "Exclusive events", "Maximum benefits"]'::jsonb
  );

  RETURN NEW;
END;
$$;

-- Триггер для автоматического создания уровней при создании программы
CREATE TRIGGER create_default_tiers_trigger
AFTER INSERT ON public.loyalty_programs
FOR EACH ROW
EXECUTE FUNCTION public.create_default_tiers_for_program();