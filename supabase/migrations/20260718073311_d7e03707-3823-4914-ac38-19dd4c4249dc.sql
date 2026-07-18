
CREATE OR REPLACE FUNCTION public.marketplace_offers_prevent_field_tamper()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
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

  IF OLD.status <> 'active' THEN
    RAISE EXCEPTION 'Only active offers can be modified';
  END IF;

  IF NEW.status NOT IN ('completed', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid status transition for marketplace offer';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_marketplace_offers_prevent_tamper ON public.marketplace_offers;
CREATE TRIGGER trg_marketplace_offers_prevent_tamper
BEFORE UPDATE ON public.marketplace_offers
FOR EACH ROW
EXECUTE FUNCTION public.marketplace_offers_prevent_field_tamper();
