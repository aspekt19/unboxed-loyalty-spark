-- Create table for SIWE nonce storage (replay attack prevention)
CREATE TABLE public.siwe_nonces (
  nonce text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  used boolean NOT NULL DEFAULT false
);

-- Enable RLS (only service role should access this table)
ALTER TABLE public.siwe_nonces ENABLE ROW LEVEL SECURITY;

-- No RLS policies = only service_role can read/write (edge functions use service role)

-- Auto-cleanup: delete nonces older than 10 minutes via pg_cron
SELECT cron.schedule(
  'cleanup-siwe-nonces',
  '*/5 * * * *',
  $$DELETE FROM public.siwe_nonces WHERE created_at < now() - interval '10 minutes'$$
);