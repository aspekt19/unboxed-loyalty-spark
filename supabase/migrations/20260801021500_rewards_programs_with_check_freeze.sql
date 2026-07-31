-- Close the same UPDATE-without-WITH-CHECK class as vouchers (377f2af):
-- merchants must remain owners after the write, and ownership/identity columns are frozen.

-- 1) rewards -----------------------------------------------------------------
DROP POLICY IF EXISTS "Merchants can update own rewards" ON public.rewards;

CREATE POLICY "Merchants can update own rewards"
ON public.rewards
FOR UPDATE
TO public
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND lower(p.wallet_address) = lower(rewards.merchant_address)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND lower(p.wallet_address) = lower(rewards.merchant_address)
  )
);

CREATE OR REPLACE FUNCTION public.prevent_reward_field_tamper()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('role', true) = 'service_role'
     OR session_user = 'postgres'
     OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  -- Ownership / program binding are immutable; merchants may still edit catalog fields.
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.merchant_address IS DISTINCT FROM OLD.merchant_address
     OR NEW.token_address IS DISTINCT FROM OLD.token_address
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Changing immutable reward fields is not allowed';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_reward_field_tamper_trg ON public.rewards;
CREATE TRIGGER prevent_reward_field_tamper_trg
BEFORE UPDATE ON public.rewards
FOR EACH ROW
EXECUTE FUNCTION public.prevent_reward_field_tamper();

-- 2) loyalty_programs --------------------------------------------------------
DROP POLICY IF EXISTS "Merchants can update own programs" ON public.loyalty_programs;

CREATE POLICY "Merchants can update own programs"
ON public.loyalty_programs
FOR UPDATE
TO public
USING (
  lower(merchant_address) = lower((
    SELECT profiles.wallet_address
    FROM public.profiles
    WHERE profiles.user_id = auth.uid()
  ))
)
WITH CHECK (
  lower(merchant_address) = lower((
    SELECT profiles.wallet_address
    FROM public.profiles
    WHERE profiles.user_id = auth.uid()
  ))
);

CREATE OR REPLACE FUNCTION public.prevent_loyalty_program_field_tamper()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('role', true) = 'service_role'
     OR session_user = 'postgres'
     OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  -- Identity / on-chain binding immutable; merchants may edit economics, status, name, dates.
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.merchant_address IS DISTINCT FROM OLD.merchant_address
     OR NEW.token_address IS DISTINCT FROM OLD.token_address
     OR NEW.symbol IS DISTINCT FROM OLD.symbol
     OR NEW.token_standard IS DISTINCT FROM OLD.token_standard
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Changing immutable loyalty program fields is not allowed';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_loyalty_program_field_tamper_trg ON public.loyalty_programs;
CREATE TRIGGER prevent_loyalty_program_field_tamper_trg
BEFORE UPDATE ON public.loyalty_programs
FOR EACH ROW
EXECUTE FUNCTION public.prevent_loyalty_program_field_tamper();
