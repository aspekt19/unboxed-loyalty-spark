ALTER TABLE public.customer_profiles
  ADD COLUMN IF NOT EXISTS cdp_wallet_address text,
  ADD COLUMN IF NOT EXISTS cdp_wallet_created_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS customer_profiles_cdp_wallet_unique
  ON public.customer_profiles (lower(cdp_wallet_address))
  WHERE cdp_wallet_address IS NOT NULL;

COMMENT ON COLUMN public.customer_profiles.cdp_wallet_address IS
  'Opt-in Coinbase CDP MPC wallet address for automated x402 payments. NULL = not enrolled.';
COMMENT ON COLUMN public.customer_profiles.cdp_wallet_created_at IS
  'Timestamp when the delegated CDP MPC wallet was created via /customer settings.';