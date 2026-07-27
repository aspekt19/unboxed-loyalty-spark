ALTER TABLE public.marketplace_offers DROP CONSTRAINT IF EXISTS marketplace_offers_status_check;
ALTER TABLE public.marketplace_offers ADD CONSTRAINT marketplace_offers_status_check
  CHECK (status = ANY (ARRAY['active'::text, 'accepted'::text, 'completed'::text, 'cancelled'::text]));

CREATE OR REPLACE FUNCTION public.marketplace_offers_prevent_field_tamper()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
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
$$;