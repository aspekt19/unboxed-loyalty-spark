-- Fix 1: Remove overly permissive policy on customer_tier_status
DROP POLICY IF EXISTS "System can update tier status" ON public.customer_tier_status;

-- Fix 2: Fix get_customers_by_segment to validate caller ownership and mask PII
CREATE OR REPLACE FUNCTION public.get_customers_by_segment(p_merchant_address text, p_token_address text, p_segment text, p_min_balance numeric DEFAULT NULL::numeric, p_max_balance numeric DEFAULT NULL::numeric)
 RETURNS TABLE(customer_address text, email text, first_name text, last_name text, balance numeric, rfm_score text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Verify caller owns this merchant address
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = auth.uid()
      AND lower(wallet_address) = lower(p_merchant_address)
  ) THEN
    RAISE EXCEPTION 'Access denied: you do not own this merchant address';
  END IF;

  RETURN QUERY
  SELECT 
    DISTINCT v.customer_address,
    mask_email(cp.email) as email,
    cp.first_name,
    cp.last_name,
    COALESCE(cts.current_balance, 0) as balance,
    COALESCE(cp.rfm_score, 'new') as rfm_score
  FROM vouchers v
  LEFT JOIN customer_profiles cp ON cp.wallet_address = v.customer_address
  LEFT JOIN customer_tier_status cts ON cts.customer_address = v.customer_address 
    AND cts.token_address = p_token_address
  WHERE v.merchant_address = p_merchant_address
    AND v.token_address = p_token_address
    AND (p_segment = 'all' OR COALESCE(cp.rfm_score, 'new') = p_segment)
    AND (p_min_balance IS NULL OR COALESCE(cts.current_balance, 0) >= p_min_balance)
    AND (p_max_balance IS NULL OR COALESCE(cts.current_balance, 0) <= p_max_balance);
END;
$function$;