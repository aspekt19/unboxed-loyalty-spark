CREATE OR REPLACE FUNCTION public.prevent_agent_plan_self_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_privileged boolean := false;
  v_price numeric;
  v_has_sub boolean;
BEGIN
  IF current_setting('role', true) = 'service_role'
     OR session_user = 'postgres'
     OR auth.uid() IS NULL
     OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  IF NEW.plan_id IS NULL
     OR (TG_OP = 'UPDATE' AND NEW.plan_id IS NOT DISTINCT FROM OLD.plan_id) THEN
    RETURN NEW;
  END IF;

  SELECT price_usd INTO v_price FROM public.agent_plans WHERE id = NEW.plan_id;
  IF COALESCE(v_price, 0) <= 0 THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.agent_plan_subscriptions s
    WHERE lower(s.owner_address) = lower(COALESCE(NEW.owner_address, ''))
      AND s.plan_id = NEW.plan_id
      AND s.status IN ('trialing', 'active')
  ) INTO v_has_sub;

  IF NOT v_has_sub THEN
    RAISE EXCEPTION 'Changing the agent plan requires a verified subscription';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_merchant_plan_self_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_price numeric;
  v_has_sub boolean;
BEGIN
  IF current_setting('role', true) = 'service_role'
     OR session_user = 'postgres'
     OR auth.uid() IS NULL
     OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  IF NEW.merchant_plan_id IS NULL
     OR (TG_OP = 'UPDATE' AND NEW.merchant_plan_id IS NOT DISTINCT FROM OLD.merchant_plan_id) THEN
    RETURN NEW;
  END IF;

  SELECT price_usd INTO v_price FROM public.merchant_plans WHERE id = NEW.merchant_plan_id;
  IF COALESCE(v_price, 0) <= 0 THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.merchant_plan_subscriptions s
    WHERE lower(s.owner_address) = lower(COALESCE(NEW.merchant_address, ''))
      AND s.plan_id = NEW.merchant_plan_id
      AND s.status IN ('trialing', 'active')
  ) INTO v_has_sub;

  IF NOT v_has_sub THEN
    RAISE EXCEPTION 'Changing the merchant plan requires a verified subscription';
  END IF;

  RETURN NEW;
END;
$$;