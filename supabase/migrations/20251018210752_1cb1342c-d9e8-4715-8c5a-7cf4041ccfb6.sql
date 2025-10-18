-- Fix RLS policy for profiles table to restrict public wallet address exposure
-- Replace overly permissive "Anyone can view profiles" policy with restricted access

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;

-- Users can only view their own profile
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT
  USING (auth.uid() = user_id);

-- Allow viewing profiles of merchants who have created rewards (for customer-facing features)
-- This enables customers to see merchant information without exposing all user addresses
CREATE POLICY "Public merchant profiles" ON public.profiles
  FOR SELECT
  USING (
    wallet_address IN (
      SELECT DISTINCT merchant_address FROM public.rewards WHERE is_active = true
    )
  );