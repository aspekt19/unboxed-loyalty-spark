-- Fix RLS policy for vouchers SELECT to work with Web3 authentication
-- Drop the old policy
DROP POLICY IF EXISTS "Merchants can view their vouchers" ON public.vouchers;

-- Create new policy that directly checks merchant_address against profile's wallet_address
CREATE POLICY "Merchants can view their vouchers" 
ON public.vouchers 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.wallet_address = vouchers.merchant_address
  )
);