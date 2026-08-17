ALTER TABLE public.loyalty_programs REPLICA IDENTITY FULL;

CREATE OR REPLACE FUNCTION public.check_program_expiration()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE loyalty_programs
  SET status = 'expiring_soon'
  WHERE status = 'active'
    AND expiration_date <= (NOW() + INTERVAL '24 hours')
    AND expiration_date > NOW();

  UPDATE loyalty_programs
  SET status = 'expired'
  WHERE status <> 'expired'
    AND expiration_date <= NOW();

  UPDATE rewards r
  SET is_active = false
  FROM loyalty_programs p
  WHERE p.status = 'expired'
    AND lower(p.token_address) = lower(r.token_address)
    AND r.is_active = true;

  UPDATE vouchers v
  SET status = 'expired'
  FROM loyalty_programs p
  WHERE p.status = 'expired'
    AND lower(p.token_address) = lower(v.token_address)
    AND v.status = 'active';
END;
$$;

SELECT cron.unschedule('check-program-expiration');
SELECT cron.schedule(
  'check-program-expiration',
  '*/15 * * * *',
  $$SELECT public.check_program_expiration();$$
);

SELECT public.check_program_expiration();