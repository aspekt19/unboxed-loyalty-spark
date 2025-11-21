-- Fix RLS policies for premium_payment_requests to use profiles table
DROP POLICY IF EXISTS "Users can view own payment requests" ON public.premium_payment_requests;
DROP POLICY IF EXISTS "Users can create payment requests" ON public.premium_payment_requests;

-- Users can view their own requests
CREATE POLICY "Users can view own payment requests"
  ON public.premium_payment_requests
  FOR SELECT
  USING (LOWER(wallet_address) = LOWER((
    SELECT profiles.wallet_address
    FROM profiles
    WHERE profiles.user_id = auth.uid()
  )));

-- Users can create their own requests
CREATE POLICY "Users can create payment requests"
  ON public.premium_payment_requests
  FOR INSERT
  WITH CHECK (LOWER(wallet_address) = LOWER((
    SELECT profiles.wallet_address
    FROM profiles
    WHERE profiles.user_id = auth.uid()
  )));