-- Hourly process-automation. The secret lives in a table anon cannot read;
-- pg_cron (superuser) sends it as x-cron-secret. No service-role key in git.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.internal_job_secrets (
  job_name text PRIMARY KEY,
  secret text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.internal_job_secrets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.internal_job_secrets FROM PUBLIC, anon, authenticated;

INSERT INTO public.internal_job_secrets (job_name, secret)
VALUES ('process-automation', encode(gen_random_bytes(32), 'hex'))
ON CONFLICT (job_name) DO NOTHING;

DO $$
BEGIN
  PERFORM cron.unschedule('process-automation-hourly');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'process-automation-hourly',
  '20 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://bzxmejzssxjazswgwqqs.supabase.co/functions/v1/process-automation',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (
        SELECT secret FROM public.internal_job_secrets WHERE job_name = 'process-automation'
      )
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
