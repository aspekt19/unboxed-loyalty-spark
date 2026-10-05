COMMENT ON TABLE public.gas_drips IS 'DEPRECATED: direct ETH top-ups to user wallets removed (bot-drain risk). Free gas is smart-wallet only via paymaster-proxy. Table kept for history.';
COMMENT ON COLUMN public.gas_settings.drip_enabled IS 'DEPRECATED: wallet top-ups removed; column unused.';
COMMENT ON COLUMN public.gas_settings.drip_amount_usd IS 'DEPRECATED: wallet top-ups removed; column unused.';
COMMENT ON COLUMN public.gas_settings.drip_min_balance_usd IS 'DEPRECATED: wallet top-ups removed; column unused.';
COMMENT ON COLUMN public.gas_settings.drip_cooldown_days IS 'DEPRECATED: wallet top-ups removed; column unused.';
COMMENT ON COLUMN public.gas_settings.drip_max_per_month IS 'DEPRECATED: wallet top-ups removed; column unused.';
COMMENT ON COLUMN public.gas_settings.low_balance_warn_usd IS 'DEPRECATED: gas wallet removed; column unused.';