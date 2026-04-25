CREATE OR REPLACE FUNCTION public.start_agent_trial(p_owner_address text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_owner text := lower(trim(p_owner_address));
  v_plan_id uuid;
  v_existing uuid;
  v_sub_id uuid;
BEGIN
  IF v_owner IS NULL OR v_owner = '' THEN RETURN NULL; END IF;

  SELECT id INTO v_existing
  FROM public.agent_plan_subscriptions
  WHERE lower(owner_address) = v_owner
  LIMIT 1;
  IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;

  SELECT id INTO v_plan_id FROM public.agent_plans
    WHERE slug = 'pro' AND is_active = true LIMIT 1;
  IF v_plan_id IS NULL THEN RETURN NULL; END IF;

  INSERT INTO public.agent_plan_subscriptions (
    owner_address, plan_id, status, amount_usdc,
    billing_cycle, is_trial, paid_at, expires_at
  ) VALUES (
    v_owner, v_plan_id, 'trialing', 0,
    'trial', true, now(), now() + interval '45 days'
  ) RETURNING id INTO v_sub_id;

  UPDATE public.agent_registry
    SET plan_id = v_plan_id
    WHERE lower(owner_address) = v_owner AND plan_id IS NULL;

  RETURN v_sub_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.start_merchant_trial(p_owner_address text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_owner text := lower(trim(p_owner_address));
  v_plan_id uuid;
  v_existing uuid;
  v_sub_id uuid;
BEGIN
  IF v_owner IS NULL OR v_owner = '' THEN RETURN NULL; END IF;

  SELECT id INTO v_existing
  FROM public.merchant_plan_subscriptions
  WHERE lower(owner_address) = v_owner
  LIMIT 1;
  IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;

  SELECT id INTO v_plan_id FROM public.merchant_plans
    WHERE slug = 'growth' AND is_active = true LIMIT 1;
  IF v_plan_id IS NULL THEN RETURN NULL; END IF;

  INSERT INTO public.merchant_plan_subscriptions (
    owner_address, plan_id, status, amount_usdc,
    billing_cycle, is_trial, paid_at, expires_at
  ) VALUES (
    v_owner, v_plan_id, 'trialing', 0,
    'trial', true, now(), now() + interval '45 days'
  ) RETURNING id INTO v_sub_id;

  UPDATE public.merchant_profiles
    SET merchant_plan_id = v_plan_id
    WHERE lower(merchant_address) = v_owner;

  RETURN v_sub_id;
END;
$function$;

-- Extend existing active trials by the 31-day delta so current users get the new duration too
UPDATE public.merchant_plan_subscriptions
  SET expires_at = paid_at + interval '45 days', updated_at = now()
  WHERE is_trial = true
    AND status = 'trialing'
    AND paid_at IS NOT NULL;

UPDATE public.agent_plan_subscriptions
  SET expires_at = paid_at + interval '45 days', updated_at = now()
  WHERE is_trial = true
    AND status = 'trialing'
    AND paid_at IS NOT NULL;