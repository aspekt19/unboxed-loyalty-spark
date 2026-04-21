
-- Enable required extensions for cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove any prior schedule with the same name (idempotent)
DO $$
BEGIN
  PERFORM cron.unschedule('expire-plan-subscriptions-hourly');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Schedule expire_plan_subscriptions to run every hour at minute 5
SELECT cron.schedule(
  'expire-plan-subscriptions-hourly',
  '5 * * * *',
  $$ SELECT public.expire_plan_subscriptions(); $$
);
