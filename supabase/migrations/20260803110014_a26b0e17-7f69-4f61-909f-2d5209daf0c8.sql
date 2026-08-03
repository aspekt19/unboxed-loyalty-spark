CREATE OR REPLACE FUNCTION public.prevent_profile_role_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_is_privileged boolean := false;
BEGIN
  IF current_setting('role', true) = 'service_role'
     OR session_user = 'postgres'
     OR public.has_role(auth.uid(), 'admin') THEN
    v_is_privileged := true;
  END IF;

  IF v_is_privileged THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- A self-created profile can never start out privileged or un-banned by hand.
    NEW.role := 'user';
    NEW.is_banned := false;
    NEW.banned_at := NULL;
    NEW.banned_by := NULL;
    NEW.ban_reason := NULL;
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Changing role is not allowed';
  END IF;

  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Changing profile owner is not allowed';
  END IF;

  IF lower(coalesce(NEW.wallet_address, '')) IS DISTINCT FROM lower(coalesce(OLD.wallet_address, '')) THEN
    RAISE EXCEPTION 'Changing the profile wallet address is not allowed';
  END IF;

  IF NEW.is_banned IS DISTINCT FROM OLD.is_banned
     OR NEW.banned_at IS DISTINCT FROM OLD.banned_at
     OR NEW.banned_by IS DISTINCT FROM OLD.banned_by
     OR NEW.ban_reason IS DISTINCT FROM OLD.ban_reason THEN
    RAISE EXCEPTION 'Changing ban/moderation fields is not allowed';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS prevent_profile_role_self_insert_trg ON public.profiles;
CREATE TRIGGER prevent_profile_role_self_insert_trg
BEFORE INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_role_self_update();

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND coalesce(role, 'user') = 'user'
  AND coalesce(is_banned, false) = false
  AND banned_at IS NULL
  AND banned_by IS NULL
  AND ban_reason IS NULL
);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND (
    public.has_role(auth.uid(), 'admin')
    OR (
      role = 'user'
      AND coalesce(is_banned, false) = false
      AND banned_at IS NULL
      AND banned_by IS NULL
      AND ban_reason IS NULL
    )
  )
);