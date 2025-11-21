-- Обновляем функцию создания дефолтных тиров с проверкой существующих
CREATE OR REPLACE FUNCTION public.create_default_tiers_for_program()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Проверяем, не существуют ли уже тиры для этого токена
  IF EXISTS (
    SELECT 1 FROM customer_tiers 
    WHERE token_address = NEW.token_address
  ) THEN
    RETURN NEW; -- Тиры уже существуют, ничего не делаем
  END IF;

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
$function$;