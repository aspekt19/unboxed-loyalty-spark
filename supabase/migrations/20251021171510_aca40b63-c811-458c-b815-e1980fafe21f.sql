-- Fix RLS policy for profiles UPDATE to allow migration function to work
-- The migrate_wallet_profile function needs to update user_id without RLS blocking it
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- New policy that allows users to update their own profile based on either old or new user_id
-- This enables the migrate_wallet_profile function to work properly
CREATE POLICY "Users can update own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = user_id);