-- Drop and recreate the migrate_wallet_profile function with better logic
DROP FUNCTION IF EXISTS public.migrate_wallet_profile(text, uuid);

CREATE OR REPLACE FUNCTION public.migrate_wallet_profile(p_wallet_address text, p_new_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- First, delete any profile that might already exist for the new user_id
  -- This prevents conflicts
  DELETE FROM public.profiles WHERE user_id = p_new_user_id;
  
  -- Update existing profile with the new user_id, or insert if doesn't exist
  INSERT INTO public.profiles (user_id, wallet_address, created_at, updated_at)
  VALUES (p_new_user_id, LOWER(p_wallet_address), NOW(), NOW())
  ON CONFLICT (wallet_address) 
  DO UPDATE SET 
    user_id = p_new_user_id,
    updated_at = NOW()
  RETURNING *;
  
  -- Log for debugging
  RAISE NOTICE 'Profile migrated for wallet % to user %', LOWER(p_wallet_address), p_new_user_id;
END;
$$;