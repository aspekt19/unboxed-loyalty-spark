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

  -- Reset agent plan_id when no active/trialing sub remains, so expired
  -- agents fall back to Free rate limits and Free transaction fees.
  UPDATE public.agent_registry ar
    SET plan_id = NULL
    WHERE plan_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.agent_plan_subscriptions s
        WHERE lower(s.owner_address) = lower(ar.owner_address)
          AND s.status IN ('active','trialing')
      );
END;
$$;

-- One-time backfill for agents left on a paid plan_id after their trial expired.
SELECT public.expire_plan_subscriptions();