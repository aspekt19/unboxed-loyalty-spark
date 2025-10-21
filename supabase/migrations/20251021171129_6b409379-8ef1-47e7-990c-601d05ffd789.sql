-- Fix RLS policy for rewards UPDATE to work with Web3 authentication
-- Drop the old policy
DROP POLICY IF EXISTS "Merchants can update own rewards" ON public.rewards;

-- Create new policy that directly checks merchant_address against profile's wallet_address
CREATE POLICY "Merchants can update own rewards" 
ON public.rewards 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.wallet_address = rewards.merchant_address
  )
);