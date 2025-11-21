-- Create premium subscriptions table
CREATE TABLE IF NOT EXISTS public.premium_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  wallet_address TEXT NOT NULL,
  is_active BOOLEAN DEFAULT false NOT NULL,
  subscription_type TEXT DEFAULT 'free' NOT NULL CHECK (subscription_type IN ('free', 'premium')),
  started_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(user_id),
  UNIQUE(wallet_address)
);

-- Enable RLS
ALTER TABLE public.premium_subscriptions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own subscription
CREATE POLICY "Users can view own subscription"
ON public.premium_subscriptions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Policy: Users can insert their own subscription
CREATE POLICY "Users can insert own subscription"
ON public.premium_subscriptions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own subscription
CREATE POLICY "Users can update own subscription"
ON public.premium_subscriptions
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_premium_subscriptions_wallet 
ON public.premium_subscriptions(wallet_address);

CREATE INDEX IF NOT EXISTS idx_premium_subscriptions_user 
ON public.premium_subscriptions(user_id);

-- Function to check if user has premium access
CREATE OR REPLACE FUNCTION public.has_premium_access(p_wallet_address TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_premium BOOLEAN;
BEGIN
  SELECT 
    COALESCE(
      is_active AND 
      subscription_type = 'premium' AND 
      (expires_at IS NULL OR expires_at > NOW()),
      false
    )
  INTO v_is_premium
  FROM premium_subscriptions
  WHERE LOWER(wallet_address) = LOWER(p_wallet_address);
  
  RETURN COALESCE(v_is_premium, false);
END;
$$;

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_premium_subscriptions_updated_at
BEFORE UPDATE ON public.premium_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();