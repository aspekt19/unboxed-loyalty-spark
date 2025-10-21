-- Fix migrate_wallet_profile function to bypass RLS
DROP FUNCTION IF EXISTS public.migrate_wallet_profile(text, uuid);

CREATE OR REPLACE FUNCTION public.migrate_wallet_profile(p_wallet_address text, p_new_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete any existing profile for the new user_id to avoid conflicts
  DELETE FROM public.profiles WHERE user_id = p_new_user_id;
  
  -- Update existing profile with new user_id or insert new one
  INSERT INTO public.profiles (user_id, wallet_address, created_at, updated_at)
  VALUES (p_new_user_id, lower(p_wallet_address), now(), now())
  ON CONFLICT (wallet_address) 
  DO UPDATE SET 
    user_id = p_new_user_id,
    updated_at = now();
END;
$$;