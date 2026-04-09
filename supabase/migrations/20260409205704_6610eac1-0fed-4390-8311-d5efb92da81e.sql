CREATE OR REPLACE FUNCTION public.has_premium_access(p_wallet_address text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_is_premium BOOLEAN;
  v_is_admin BOOLEAN;
BEGIN
  -- Admins always have full premium access
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.profiles p ON p.user_id = ur.user_id
    WHERE LOWER(p.wallet_address) = LOWER(p_wallet_address)
      AND ur.role = 'admin'
  ) INTO v_is_admin;

  IF v_is_admin THEN
    RETURN true;
  END IF;

  SELECT 
    COALESCE(
      subscription_type = 'premium' AND 
      subscription_status IN ('active', 'trialing') AND
      (expires_at IS NULL OR expires_at > NOW()),
      false
    )
  INTO v_is_premium
  FROM premium_subscriptions
  WHERE LOWER(wallet_address) = LOWER(p_wallet_address);
  
  RETURN COALESCE(v_is_premium, false);
END;
$$;