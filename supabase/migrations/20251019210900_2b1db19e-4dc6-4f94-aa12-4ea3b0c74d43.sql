-- Drop incorrect policy
DROP POLICY IF EXISTS "Users can update profile by wallet address" ON public.profiles;

-- Create a security definer function to migrate wallet to new session
CREATE OR REPLACE FUNCTION public.migrate_wallet_profile(
  p_wallet_address text,
  p_new_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update existing profile with new user_id
  UPDATE public.profiles
  SET user_id = p_new_user_id,
      updated_at = now()
  WHERE wallet_address = lower(p_wallet_address);
  
  -- If no profile exists, insert a new one
  IF NOT FOUND THEN
    INSERT INTO public.profiles (user_id, wallet_address)
    VALUES (p_new_user_id, lower(p_wallet_address));
  END IF;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.migrate_wallet_profile TO authenticated;