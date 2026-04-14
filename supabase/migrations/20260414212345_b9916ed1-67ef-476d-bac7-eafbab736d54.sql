
-- Create merchant profiles table
CREATE TABLE public.merchant_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_address TEXT NOT NULL UNIQUE,
  business_name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  logo_url TEXT,
  description TEXT,
  website TEXT,
  location TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.merchant_profiles ENABLE ROW LEVEL SECURITY;

-- Anyone can view merchant profiles (public storefront cards)
CREATE POLICY "Anyone can view merchant profiles"
ON public.merchant_profiles
FOR SELECT
USING (true);

-- Merchants can create their own profile
CREATE POLICY "Merchants can create own profile"
ON public.merchant_profiles
FOR INSERT
TO authenticated
WITH CHECK (
  merchant_address = (
    SELECT profiles.wallet_address
    FROM profiles
    WHERE profiles.user_id = auth.uid()
  )
);

-- Merchants can update their own profile
CREATE POLICY "Merchants can update own profile"
ON public.merchant_profiles
FOR UPDATE
TO authenticated
USING (
  merchant_address = (
    SELECT profiles.wallet_address
    FROM profiles
    WHERE profiles.user_id = auth.uid()
  )
);

-- Merchants can delete their own profile
CREATE POLICY "Merchants can delete own profile"
ON public.merchant_profiles
FOR DELETE
TO authenticated
USING (
  merchant_address = (
    SELECT profiles.wallet_address
    FROM profiles
    WHERE profiles.user_id = auth.uid()
  )
);

-- Service role full access
CREATE POLICY "Service role full access merchant profiles"
ON public.merchant_profiles
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Trigger for updated_at
CREATE TRIGGER update_merchant_profiles_updated_at
BEFORE UPDATE ON public.merchant_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index for category filtering
CREATE INDEX idx_merchant_profiles_category ON public.merchant_profiles (category);

-- Index for search by business name
CREATE INDEX idx_merchant_profiles_business_name ON public.merchant_profiles USING gin (to_tsvector('english', business_name));
