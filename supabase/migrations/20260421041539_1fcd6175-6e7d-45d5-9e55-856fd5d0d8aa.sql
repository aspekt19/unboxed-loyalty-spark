
-- =========================================
-- Trial support + billing cycle persistence
-- =========================================

-- 1. Add billing_cycle + is_trial to subscriptions
ALTER TABLE public.merchant_plan_subscriptions
  ADD COLUMN IF NOT EXISTS billing_cycle text NOT NULL DEFAULT 'monthly'
    CHECK (billing_cycle IN ('monthly','annual','trial')),
  ADD COLUMN IF NOT EXISTS is_trial boolean NOT NULL DEFAULT false;

ALTER TABLE public.agent_plan_subscriptions
  ADD COLUMN IF NOT EXISTS billing_cycle text NOT NULL DEFAULT 'monthly'
    CHECK (billing_cycle IN ('monthly','annual','trial')),
  ADD COLUMN IF NOT EXISTS is_trial boolean NOT NULL DEFAULT false;

-- 'trialing' is a valid status (no enum to alter, status is text), just document via comment
COMMENT ON COLUMN public.merchant_plan_subscriptions.status IS
  'pending | pending_verification | active | trialing | expired | cancelled';
COMMENT ON COLUMN public.agent_plan_subscriptions.status IS
  'pending | pending_verification | active | trialing | expired | cancelled';

-- 2. Helper: start a 14-day trial for a merchant (Growth) — idempotent
CREATE OR REPLACE FUNCTION public.start_merchant_trial(p_owner_address text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner text := lower(trim(p_owner_address));
  v_plan_id uuid;
  v_existing uuid;
  v_sub_id uuid;
BEGIN
  IF v_owner IS NULL OR v_owner = '' THEN RETURN NULL; END IF;

  -- Already has any subscription (trial / active / expired / pending) → skip
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
    'trial', true, now(), now() + interval '14 days'
  ) RETURNING id INTO v_sub_id;

  -- Reflect on merchant_profiles for feature-gating
  UPDATE public.merchant_profiles
    SET merchant_plan_id = v_plan_id
    WHERE lower(merchant_address) = v_owner;

  RETURN v_sub_id;
END;
$$;

-- 3. Helper: start a 14-day trial for an agent owner (Pro) — idempotent
CREATE OR REPLACE FUNCTION public.start_agent_trial(p_owner_address text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    'trial', true, now(), now() + interval '14 days'
  ) RETURNING id INTO v_sub_id;

  UPDATE public.agent_registry
    SET plan_id = v_plan_id
    WHERE lower(owner_address) = v_owner AND plan_id IS NULL;

  RETURN v_sub_id;
END;
$$;

-- 4. Trigger: when an agent is created, start agent trial automatically
CREATE OR REPLACE FUNCTION public.auto_start_agent_trial()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.start_agent_trial(NEW.owner_address);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_start_agent_trial ON public.agent_registry;
CREATE TRIGGER trg_auto_start_agent_trial
  AFTER INSERT ON public.agent_registry
  FOR EACH ROW EXECUTE FUNCTION public.auto_start_agent_trial();

-- 5. Trigger: when a merchant_profile is created, start merchant trial
CREATE OR REPLACE FUNCTION public.auto_start_merchant_trial()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.start_merchant_trial(NEW.merchant_address);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_start_merchant_trial ON public.merchant_profiles;
CREATE TRIGGER trg_auto_start_merchant_trial
  AFTER INSERT ON public.merchant_profiles
  FOR EACH ROW EXECUTE FUNCTION public.auto_start_merchant_trial();

-- 6. Allow the user to invoke the trial helpers from the client (SECURITY DEFINER already enforces auth via wallet match in code)
GRANT EXECUTE ON FUNCTION public.start_merchant_trial(text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.start_agent_trial(text) TO authenticated, anon;

-- 7. Cron-style cleanup: expire trials/paid subs once per day
CREATE OR REPLACE FUNCTION public.expire_plan_subscriptions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.merchant_plan_subscriptions
    SET status = 'expired', updated_at = now()
    WHERE status IN ('active','trialing')
      AND expires_at IS NOT NULL
      AND expires_at < now();

  UPDATE public.agent_plan_subscriptions
    SET status = 'expired', updated_at = now()
    WHERE status IN ('active','trialing')
      AND expires_at IS NOT NULL
      AND expires_at < now();

  -- Reset merchant_plan_id when no active/trialing sub remains
  UPDATE public.merchant_profiles mp
    SET merchant_plan_id = NULL
    WHERE merchant_plan_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.merchant_plan_subscriptions s
        WHERE lower(s.owner_address) = lower(mp.merchant_address)
          AND s.status IN ('active','trialing')
      );
END;
$$;
