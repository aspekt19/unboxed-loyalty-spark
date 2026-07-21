
-- Extend profile self-update protection to ban fields (and keep role protection)
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

  IF NEW.role IS DISTINCT FROM OLD.role AND NOT v_is_privileged THEN
    RAISE EXCEPTION 'Changing role is not allowed';
  END IF;

  IF NOT v_is_privileged THEN
    IF NEW.is_banned IS DISTINCT FROM OLD.is_banned
       OR NEW.banned_at IS DISTINCT FROM OLD.banned_at
       OR NEW.banned_by IS DISTINCT FROM OLD.banned_by
       OR NEW.ban_reason IS DISTINCT FROM OLD.ban_reason THEN
      RAISE EXCEPTION 'Changing ban/moderation fields is not allowed';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Ensure trigger exists on profiles
DROP TRIGGER IF EXISTS prevent_profile_role_self_update_trg ON public.profiles;
CREATE TRIGGER prevent_profile_role_self_update_trg
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_role_self_update();

-- Prevent customers from tampering with their own loyalty metrics
CREATE OR REPLACE FUNCTION public.prevent_customer_metric_self_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF current_setting('role', true) = 'service_role'
     OR session_user = 'postgres'
     OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  IF NEW.total_purchases IS DISTINCT FROM OLD.total_purchases
     OR NEW.total_spent IS DISTINCT FROM OLD.total_spent
     OR NEW.rfm_score IS DISTINCT FROM OLD.rfm_score
     OR NEW.last_purchase_date IS DISTINCT FROM OLD.last_purchase_date THEN
    RAISE EXCEPTION 'Changing purchase/loyalty metric fields is not allowed';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS prevent_customer_metric_self_update_trg ON public.customer_profiles;
CREATE TRIGGER prevent_customer_metric_self_update_trg
BEFORE UPDATE ON public.customer_profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_customer_metric_self_update();
