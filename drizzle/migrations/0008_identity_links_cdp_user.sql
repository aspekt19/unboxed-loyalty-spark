ALTER TABLE public.identity_links DROP CONSTRAINT IF EXISTS identity_links_link_type_check;
ALTER TABLE public.identity_links ADD CONSTRAINT identity_links_link_type_check
  CHECK (link_type IN ('wallet', 'email', 'privy_did', 'cdp_user'));
COMMENT ON CONSTRAINT identity_links_link_type_check ON public.identity_links IS 'privy_did is DEPRECATED: replaced by cdp_user (Coinbase embedded wallets)';