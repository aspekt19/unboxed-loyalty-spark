-- Drop and recreate migrate_wallet_profile to return profile data directly
DROP FUNCTION IF EXISTS public.migrate_wallet_profile(text, uuid);

CREATE OR REPLACE FUNCTION public.migrate_wallet_profile(
  p_wallet_address text,
  p_new_user_id uuid
)
RETURNS TABLE(
  id uuid,
  user_id uuid,
  wallet_address text,
  role text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
BEGIN
  -- First, delete any profile that might already exist for the new user_id
  DELETE FROM public.profiles WHERE profiles.user_id = p_new_user_id;
  
  -- Update existing profile with the new user_id, or insert if doesn't exist
  INSERT INTO public.profiles (user_id, wallet_address, created_at, updated_at)
  VALUES (p_new_user_id, LOWER(p_wallet_address), NOW(), NOW())
  ON CONFLICT (wallet_address) 
  DO UPDATE SET 
    user_id = p_new_user_id,
    updated_at = NOW()
  RETURNING profiles.id INTO v_profile_id;
  
  -- Return the profile data directly (bypasses RLS since we're in SECURITY DEFINER)
  RETURN QUERY
  SELECT p.id, p.user_id, p.wallet_address, p.role
  FROM public.profiles p
  WHERE p.id = v_profile_id;
END;
$$;