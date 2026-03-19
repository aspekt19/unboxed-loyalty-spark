-- Make migrate_wallet_profile silently return empty instead of raising an exception
-- This prevents error toasts if old cached clients still call it
CREATE OR REPLACE FUNCTION public.migrate_wallet_profile(p_wallet_address text, p_new_user_id uuid)
 RETURNS TABLE(profile_id uuid, profile_user_id uuid, profile_wallet_address text, profile_role text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Deprecated: authentication is now handled via SIWE
  -- Return empty result set silently
  RETURN;
END;
$function$;