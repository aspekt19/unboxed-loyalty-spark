-- Create profiles table to store wallet addresses
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  wallet_address TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles are viewable by everyone (public blockchain addresses)
CREATE POLICY "Anyone can view profiles" ON public.profiles
  FOR SELECT USING (true);

-- Users can only insert their own profile
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can only update their own profile
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);

-- Add trigger for updated_at on profiles
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Drop existing insecure policies on rewards table
DROP POLICY IF EXISTS "Anyone can create rewards" ON public.rewards;
DROP POLICY IF EXISTS "Merchants can update their rewards" ON public.rewards;
DROP POLICY IF EXISTS "Merchants can delete their rewards" ON public.rewards;

-- Create secure policies for rewards table
CREATE POLICY "Authenticated merchants can create rewards" ON public.rewards
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL 
    AND merchant_address = (
      SELECT wallet_address FROM public.profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Merchants can update own rewards" ON public.rewards
  FOR UPDATE
  USING (
    merchant_address = (
      SELECT wallet_address FROM public.profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Merchants can delete own rewards" ON public.rewards
  FOR DELETE
  USING (
    merchant_address = (
      SELECT wallet_address FROM public.profiles WHERE user_id = auth.uid()
    )
  );

-- Drop existing insecure policies on vouchers table
DROP POLICY IF EXISTS "Anyone can view vouchers" ON public.vouchers;
DROP POLICY IF EXISTS "Anyone can create vouchers" ON public.vouchers;
DROP POLICY IF EXISTS "Anyone can update vouchers" ON public.vouchers;

-- Create secure policies for vouchers table
CREATE POLICY "Customers can view own vouchers" ON public.vouchers
  FOR SELECT
  USING (
    customer_address = (
      SELECT wallet_address FROM public.profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Merchants can view their vouchers" ON public.vouchers
  FOR SELECT
  USING (
    merchant_address = (
      SELECT wallet_address FROM public.profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated customers can create vouchers" ON public.vouchers
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL 
    AND customer_address = (
      SELECT wallet_address FROM public.profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Merchants can update their vouchers" ON public.vouchers
  FOR UPDATE
  USING (
    merchant_address = (
      SELECT wallet_address FROM public.profiles WHERE user_id = auth.uid()
    )
  );