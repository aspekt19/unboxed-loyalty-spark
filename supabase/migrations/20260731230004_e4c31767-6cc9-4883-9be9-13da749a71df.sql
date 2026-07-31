-- 1) Add WITH CHECK to the merchant UPDATE policy so a voucher cannot be moved to another merchant
DROP POLICY IF EXISTS "Merchants can update their vouchers" ON public.vouchers;

CREATE POLICY "Merchants can update their vouchers"
ON public.vouchers
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND lower(p.wallet_address) = lower(vouchers.merchant_address)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND lower(p.wallet_address) = lower(vouchers.merchant_address)
  )
);

-- 2) Freeze immutable voucher fields for non-privileged sessions
CREATE OR REPLACE FUNCTION public.prevent_voucher_field_tamper()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_privileged boolean := false;
BEGIN
  IF current_setting('role', true) = 'service_role'
     OR session_user = 'postgres'
     OR auth.uid() IS NULL THEN
    v_is_privileged := true;
  END IF;

  IF v_is_privileged THEN
    RETURN NEW;
  END IF;

  IF NEW.code IS DISTINCT FROM OLD.code
     OR NEW.reward_id IS DISTINCT FROM OLD.reward_id
     OR NEW.token_address IS DISTINCT FROM OLD.token_address
     OR NEW.token_symbol IS DISTINCT FROM OLD.token_symbol
     OR NEW.customer_address IS DISTINCT FROM OLD.customer_address
     OR NEW.merchant_address IS DISTINCT FROM OLD.merchant_address
     OR NEW.cost IS DISTINCT FROM OLD.cost
     OR NEW.activated_at IS DISTINCT FROM OLD.activated_at
     OR NEW.reward_name IS DISTINCT FROM OLD.reward_name THEN
    RAISE EXCEPTION 'Changing immutable voucher fields is not allowed';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_voucher_field_tamper_trg ON public.vouchers;
CREATE TRIGGER prevent_voucher_field_tamper_trg
BEFORE UPDATE ON public.vouchers
FOR EACH ROW
EXECUTE FUNCTION public.prevent_voucher_field_tamper();