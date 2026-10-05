ALTER TABLE public.gas_settings
  ADD COLUMN IF NOT EXISTS budget_warn_percent numeric NOT NULL DEFAULT 80,
  ADD COLUMN IF NOT EXISTS low_balance_warn_usd numeric NOT NULL DEFAULT 2;

COMMENT ON COLUMN public.gas_settings.budget_warn_percent IS 'Warn admins when monthly gas spend reaches this percent of the budget.';
COMMENT ON COLUMN public.gas_settings.low_balance_warn_usd IS 'Warn admins when the gas wallet balance drops below this USD value.';