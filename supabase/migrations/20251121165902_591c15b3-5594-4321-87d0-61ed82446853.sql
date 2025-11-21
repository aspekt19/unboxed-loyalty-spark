-- Update premium_subscriptions table for Stripe integration
ALTER TABLE public.premium_subscriptions 
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'inactive' 
  CHECK (subscription_status IN ('inactive', 'active', 'past_due', 'canceled', 'trialing')),
ADD COLUMN IF NOT EXISTS price_id TEXT,
ADD COLUMN IF NOT EXISTS monthly_price NUMERIC DEFAULT 10.00,
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD';

-- Update subscription_type to reflect new model
COMMENT ON COLUMN public.premium_subscriptions.subscription_type IS 
  'free = Aave strategy only, premium = Compound strategy access ($10/month)';

-- Create index for Stripe lookups
CREATE INDEX IF NOT EXISTS idx_premium_subscriptions_stripe_customer 
ON public.premium_subscriptions(stripe_customer_id);

CREATE INDEX IF NOT EXISTS idx_premium_subscriptions_stripe_subscription 
ON public.premium_subscriptions(stripe_subscription_id);

-- Update has_premium_access function for new subscription model
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
      subscription_type = 'premium' AND 
      subscription_status IN ('active', 'trialing') AND
      (expires_at IS NULL OR expires_at > NOW()),
      false
    )
  INTO v_is_premium
  FROM premium_subscriptions
  WHERE LOWER(wallet_address) = LOWER(p_wallet_address);
  
  RETURN COALESCE(v_is_premium, false);
END;
$$;