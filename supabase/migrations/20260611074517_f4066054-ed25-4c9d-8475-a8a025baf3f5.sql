
-- 1) Prevent verifying the same tx hash twice
CREATE UNIQUE INDEX IF NOT EXISTS premium_payment_requests_verified_txhash_uniq
  ON public.premium_payment_requests (lower(transaction_hash))
  WHERE status = 'verified' AND transaction_hash IS NOT NULL;

-- 2) Prevent users from escalating role on profiles via UPDATE
CREATE OR REPLACE FUNCTION public.prevent_profile_role_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    -- Allow only service_role / superuser to change role
    IF current_setting('role', true) = 'service_role'
       OR session_user = 'postgres' THEN
      RETURN NEW;
    END IF;
    -- Allow admins
    IF public.has_role(auth.uid(), 'admin') THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Changing role is not allowed';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_profile_role_self_update_trg ON public.profiles;
CREATE TRIGGER prevent_profile_role_self_update_trg
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_profile_role_self_update();
