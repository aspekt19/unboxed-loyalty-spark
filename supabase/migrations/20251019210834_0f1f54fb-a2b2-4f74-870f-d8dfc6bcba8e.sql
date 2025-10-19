-- Allow users to update profile if wallet address matches
-- This allows migrating to a new session while keeping the same wallet
CREATE POLICY "Users can update profile by wallet address"
ON public.profiles
FOR UPDATE
USING (wallet_address = (
  SELECT wallet_address 
  FROM public.profiles 
  WHERE user_id = auth.uid()
));