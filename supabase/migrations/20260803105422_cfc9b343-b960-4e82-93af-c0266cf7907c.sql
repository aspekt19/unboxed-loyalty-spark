-- 1) Block self plan escalation on agent_registry
CREATE OR REPLACE FUNCTION public.prevent_agent_plan_self_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_privileged boolean := false;
  v_price numeric;
BEGIN
  IF current_setting('role', true) = 'service_role'
     OR session_user = 'postgres'
     OR auth.uid() IS NULL
     OR public.has_role(auth.uid(), 'admin') THEN
    v_privileged := true;
  END IF;

  IF v_privileged THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.plan_id IS DISTINCT FROM OLD.plan_id THEN
    RAISE EXCEPTION 'Changing the agent plan requires a verified payment';
  END IF;

  IF TG_OP = 'INSERT' AND NEW.plan_id IS NOT NULL THEN
    SELECT price_usd INTO v_price FROM public.agent_plans WHERE id = NEW.plan_id;
    IF COALESCE(v_price, 0) > 0 THEN
      RAISE EXCEPTION 'Paid agent plans require a verified payment';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_agent_plan_self_escalation_trg ON public.agent_registry;
CREATE TRIGGER prevent_agent_plan_self_escalation_trg
BEFORE INSERT OR UPDATE ON public.agent_registry
FOR EACH ROW EXECUTE FUNCTION public.prevent_agent_plan_self_escalation();

-- 2) Block self plan escalation on merchant_profiles
CREATE OR REPLACE FUNCTION public.prevent_merchant_plan_self_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_privileged boolean := false;
  v_price numeric;
BEGIN
  IF current_setting('role', true) = 'service_role'
     OR session_user = 'postgres'
     OR auth.uid() IS NULL
     OR public.has_role(auth.uid(), 'admin') THEN
    v_privileged := true;
  END IF;

  IF v_privileged THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.merchant_plan_id IS DISTINCT FROM OLD.merchant_plan_id THEN
    RAISE EXCEPTION 'Changing the merchant plan requires a verified payment';
  END IF;

  IF TG_OP = 'INSERT' AND NEW.merchant_plan_id IS NOT NULL THEN
    SELECT price_usd INTO v_price FROM public.merchant_plans WHERE id = NEW.merchant_plan_id;
    IF COALESCE(v_price, 0) > 0 THEN
      RAISE EXCEPTION 'Paid merchant plans require a verified payment';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_merchant_plan_self_escalation_trg ON public.merchant_profiles;
CREATE TRIGGER prevent_merchant_plan_self_escalation_trg
BEFORE INSERT OR UPDATE ON public.merchant_profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_merchant_plan_self_escalation();

-- 3) Case-insensitive wallet comparisons on marketplace_offers
DROP POLICY IF EXISTS "Creators can view own offers" ON public.marketplace_offers;
CREATE POLICY "Creators can view own offers"
ON public.marketplace_offers FOR SELECT TO authenticated
USING (lower(creator_address) = lower(COALESCE((SELECT p.wallet_address FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1), '')));

DROP POLICY IF EXISTS "Authenticated users can create offers" ON public.marketplace_offers;
CREATE POLICY "Authenticated users can create offers"
ON public.marketplace_offers FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL AND lower(creator_address) = lower(COALESCE((SELECT p.wallet_address FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1), '')));

DROP POLICY IF EXISTS "Creators can cancel own offers" ON public.marketplace_offers;
CREATE POLICY "Creators can cancel own offers"
ON public.marketplace_offers FOR UPDATE TO authenticated
USING (lower(creator_address) = lower(COALESCE((SELECT p.wallet_address FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1), '')) AND status = 'active')
WITH CHECK (status = 'cancelled');

DROP POLICY IF EXISTS "Authenticated users can complete active offers" ON public.marketplace_offers;
CREATE POLICY "Authenticated users can complete active offers"
ON public.marketplace_offers FOR UPDATE TO authenticated
USING (status = 'active' AND lower(creator_address) <> lower(COALESCE((SELECT p.wallet_address FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1), '')))
WITH CHECK (status = 'completed' AND lower(completed_by) = lower(COALESCE((SELECT p.wallet_address FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1), '')));

-- 4) Case-insensitive merchant voucher SELECT
DROP POLICY IF EXISTS "Merchants can view their vouchers" ON public.vouchers;
CREATE POLICY "Merchants can view their vouchers"
ON public.vouchers FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND lower(p.wallet_address) = lower(vouchers.merchant_address)));