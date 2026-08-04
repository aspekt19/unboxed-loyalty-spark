-- 1) Explicit, intentional public read policy for certificate images
DROP POLICY IF EXISTS "Public can view certificate images" ON storage.objects;
CREATE POLICY "Public can view certificate images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'certificate-images');

-- 2) Harden marketplace offer immutability (amounts/tokens locked on every update path)
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

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.creator_address IS DISTINCT FROM OLD.creator_address
     OR NEW.offer_token_address IS DISTINCT FROM OLD.offer_token_address
     OR NEW.offer_amount IS DISTINCT FROM OLD.offer_amount
     OR NEW.request_token_address IS DISTINCT FROM OLD.request_token_address
     OR NEW.request_amount IS DISTINCT FROM OLD.request_amount
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
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
$$;

DROP TRIGGER IF EXISTS trg_marketplace_offers_prevent_tamper ON public.marketplace_offers;
CREATE TRIGGER trg_marketplace_offers_prevent_tamper
BEFORE UPDATE ON public.marketplace_offers
FOR EACH ROW EXECUTE FUNCTION public.marketplace_offers_prevent_field_tamper();

-- Cancellation path also pinned to the creator and unchanged economics
DROP POLICY IF EXISTS "Creators can cancel own offers" ON public.marketplace_offers;
CREATE POLICY "Creators can cancel own offers"
ON public.marketplace_offers
FOR UPDATE
TO authenticated
USING (
  status = 'active'
  AND lower(creator_address) = lower(COALESCE((SELECT p.wallet_address FROM profiles p WHERE p.user_id = auth.uid() LIMIT 1), ''))
)
WITH CHECK (
  status = 'cancelled'
  AND lower(creator_address) = lower(COALESCE((SELECT p.wallet_address FROM profiles p WHERE p.user_id = auth.uid() LIMIT 1), ''))
  AND offer_amount > 0
  AND request_amount > 0
);