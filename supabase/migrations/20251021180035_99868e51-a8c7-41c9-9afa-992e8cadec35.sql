-- Create a security definer function to update loyalty program status
-- This bypasses RLS and checks ownership internally
CREATE OR REPLACE FUNCTION public.update_program_status(
  p_token_address text,
  p_merchant_address text,
  p_new_status text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_user_wallet text;
BEGIN
  -- Get the wallet address for the current authenticated user
  SELECT wallet_address INTO v_user_wallet
  FROM public.profiles
  WHERE user_id = auth.uid();
  
  -- Check if the user owns this program
  IF v_user_wallet IS NULL OR lower(v_user_wallet) != lower(p_merchant_address) THEN
    RETURN false;
  END IF;
  
  -- Update the program status
  UPDATE public.loyalty_programs
  SET status = p_new_status,
      updated_at = now()
  WHERE lower(token_address) = lower(p_token_address)
    AND lower(merchant_address) = lower(p_merchant_address);
  
  RETURN FOUND;
END;
$$;