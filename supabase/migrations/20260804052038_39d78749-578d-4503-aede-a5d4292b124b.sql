
-- 1) Marketplace offers: harden completion policy
DROP POLICY IF EXISTS "Authenticated users can complete active offers" ON public.marketplace_offers;
CREATE POLICY "Authenticated users can complete active offers"
ON public.marketplace_offers
FOR UPDATE
TO authenticated
USING (
  status = 'active'
  AND lower(creator_address) <> lower(COALESCE((SELECT p.wallet_address FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1), ''))
)
WITH CHECK (
  status = 'completed'
  AND lower(completed_by) = lower(COALESCE((SELECT p.wallet_address FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1), ''))
  AND completed_at IS NOT NULL
  AND lower(creator_address) <> lower(COALESCE((SELECT p.wallet_address FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1), ''))
  AND offer_amount > 0
  AND request_amount > 0
);

-- Trade terms immutability is enforced by trigger trg_marketplace_offers_prevent_tamper;
-- ensure it also locks completed_by/completed_at from being rewritten after completion.
CREATE OR REPLACE FUNCTION public.marketplace_offers_prevent_field_tamper()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.creator_address IS DISTINCT FROM OLD.creator_address
     OR NEW.offer_token_address IS DISTINCT FROM OLD.offer_token_address
     OR NEW.offer_amount IS DISTINCT FROM OLD.offer_amount
     OR NEW.request_token_address IS DISTINCT FROM OLD.request_token_address
     OR NEW.request_amount IS DISTINCT FROM OLD.request_amount
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.id IS DISTINCT FROM OLD.id
  THEN
    RAISE EXCEPTION 'Immutable marketplace offer fields cannot be modified';
  END IF;

  IF OLD.completed_by IS NOT NULL AND NEW.completed_by IS DISTINCT FROM OLD.completed_by THEN
    RAISE EXCEPTION 'Completed offer counterparty cannot be changed';
  END IF;

  IF OLD.status NOT IN ('active', 'accepted') THEN
    RAISE EXCEPTION 'Only active or accepted offers can be modified';
  END IF;

  IF OLD.status = 'active' AND NEW.status NOT IN ('accepted', 'completed', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid status transition for marketplace offer';
  END IF;

  IF OLD.status = 'accepted' AND NEW.status NOT IN ('completed', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid status transition for marketplace offer';
  END IF;

  RETURN NEW;
END;
$function$;

-- 2) Vouchers: restrict merchant updates to redemption fields only
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
  AND status IN ('active', 'used', 'expired', 'cancelled')
);

CREATE OR REPLACE FUNCTION public.prevent_voucher_field_tamper()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only backend/service contexts bypass the immutability guard
  IF current_setting('role', true) = 'service_role' OR session_user = 'postgres' THEN
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
     OR NEW.reward_name IS DISTINCT FROM OLD.reward_name
     OR NEW.reward_description IS DISTINCT FROM OLD.reward_description
     OR NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Changing immutable voucher fields is not allowed';
  END IF;

  -- Once a voucher is used it is final
  IF OLD.status = 'used' AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Used vouchers cannot change status';
  END IF;

  IF NEW.status NOT IN ('active', 'used', 'expired', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid voucher status';
  END IF;

  RETURN NEW;
END;
$function$;
