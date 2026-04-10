
CREATE OR REPLACE FUNCTION public.cancel_stale_marketplace_offers(p_max_age_days integer DEFAULT 14)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE marketplace_offers
  SET status = 'cancelled',
      updated_at = now()
  WHERE status = 'active'
    AND created_at < now() - (p_max_age_days || ' days')::interval;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
