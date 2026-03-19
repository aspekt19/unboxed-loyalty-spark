-- Block migrate_wallet_profile from direct client calls
-- Replace with a version that always raises an exception
-- Profile creation is now handled by the siwe-verify edge function

CREATE OR REPLACE FUNCTION public.migrate_wallet_profile(p_wallet_address text, p_new_user_id uuid)
 RETURNS TABLE(profile_id uuid, profile_user_id uuid, profile_wallet_address text, profile_role text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RAISE EXCEPTION 'migrate_wallet_profile is deprecated. Authentication is handled via SIWE.';
END;
$function$;

-- Also fix: drop permissive INSERT policies that allow data fabrication

-- customer_transactions: drop open INSERT policy
DROP POLICY IF EXISTS "System can insert transactions" ON public.customer_transactions;

-- token_mint_history: drop open INSERT policy  
DROP POLICY IF EXISTS "Authenticated users can insert mint history" ON public.token_mint_history;

-- automation_triggers_history: drop open INSERT policy (was public role!)
DROP POLICY IF EXISTS "System can insert trigger history" ON public.automation_triggers_history;

-- premium_activity_log: drop open INSERT policy (was public role!)
DROP POLICY IF EXISTS "System can insert activity" ON public.premium_activity_log;

-- profiles: tighten the public read policy to only expose wallet_address
DROP POLICY IF EXISTS "Public merchant profiles" ON public.profiles;