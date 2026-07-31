DROP POLICY IF EXISTS "Customers can update own reviews" ON public.reviews;

CREATE POLICY "Customers can update own reviews"
ON public.reviews
FOR UPDATE
TO authenticated
USING (customer_address = (SELECT profiles.wallet_address FROM public.profiles WHERE profiles.user_id = auth.uid()))
WITH CHECK (customer_address = (SELECT profiles.wallet_address FROM public.profiles WHERE profiles.user_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.prevent_review_field_tamper()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF current_setting('role', true) = 'service_role'
     OR session_user = 'postgres'
     OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  IF NEW.customer_address IS DISTINCT FROM OLD.customer_address
     OR NEW.merchant_address IS DISTINCT FROM OLD.merchant_address
     OR NEW.token_address IS DISTINCT FROM OLD.token_address
     OR NEW.voucher_id IS DISTINCT FROM OLD.voucher_id
     OR NEW.is_verified IS DISTINCT FROM OLD.is_verified
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Only rating and comment can be updated on a review';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_review_field_tamper ON public.reviews;
CREATE TRIGGER trg_prevent_review_field_tamper
BEFORE UPDATE ON public.reviews
FOR EACH ROW EXECUTE FUNCTION public.prevent_review_field_tamper();