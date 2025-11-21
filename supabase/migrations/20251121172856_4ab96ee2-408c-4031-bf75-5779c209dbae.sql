-- Create payment settings table for storing admin wallet
CREATE TABLE IF NOT EXISTS public.payment_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_wallet_address TEXT NOT NULL,
  usdc_price DECIMAL NOT NULL DEFAULT 10.00,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.payment_settings ENABLE ROW LEVEL SECURITY;

-- Everyone can read payment settings
CREATE POLICY "Anyone can view payment settings"
  ON public.payment_settings
  FOR SELECT
  USING (true);

-- Create premium payment requests table
CREATE TABLE IF NOT EXISTS public.premium_payment_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL,
  transaction_hash TEXT,
  payment_type TEXT NOT NULL CHECK (payment_type IN ('usdc', 'eth')),
  amount DECIMAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  verified_at TIMESTAMPTZ,
  verified_by TEXT
);

-- Enable RLS
ALTER TABLE public.premium_payment_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own requests
CREATE POLICY "Users can view own payment requests"
  ON public.premium_payment_requests
  FOR SELECT
  USING (LOWER(wallet_address) = LOWER(auth.jwt() ->> 'wallet_address'));

-- Users can create their own requests
CREATE POLICY "Users can create payment requests"
  ON public.premium_payment_requests
  FOR INSERT
  WITH CHECK (LOWER(wallet_address) = LOWER(auth.jwt() ->> 'wallet_address'));

-- Insert default payment settings
INSERT INTO public.payment_settings (admin_wallet_address, usdc_price)
VALUES ('0x0000000000000000000000000000000000000000', 10.00)
ON CONFLICT DO NOTHING;

-- Function to activate premium after payment verification
CREATE OR REPLACE FUNCTION public.activate_premium_subscription(
  p_wallet_address TEXT,
  p_request_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update payment request status
  UPDATE premium_payment_requests
  SET status = 'verified',
      verified_at = NOW()
  WHERE id = p_request_id
    AND LOWER(wallet_address) = LOWER(p_wallet_address);
  
  -- Insert or update premium subscription
  INSERT INTO premium_subscriptions (
    wallet_address,
    user_id,
    subscription_type,
    subscription_status,
    is_active,
    started_at,
    expires_at
  )
  VALUES (
    LOWER(p_wallet_address),
    (SELECT user_id FROM profiles WHERE LOWER(wallet_address) = LOWER(p_wallet_address) LIMIT 1),
    'premium',
    'active',
    TRUE,
    NOW(),
    NOW() + INTERVAL '30 days'
  )
  ON CONFLICT (wallet_address)
  DO UPDATE SET
    subscription_status = 'active',
    is_active = TRUE,
    started_at = NOW(),
    expires_at = NOW() + INTERVAL '30 days',
    updated_at = NOW();
  
  RETURN TRUE;
END;
$$;