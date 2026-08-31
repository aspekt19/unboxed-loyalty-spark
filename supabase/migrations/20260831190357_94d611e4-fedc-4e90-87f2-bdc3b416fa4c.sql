CREATE OR REPLACE FUNCTION public.consume_agent_mint_quota(
  p_agent_id uuid,
  p_owner_address text,
  p_mint_amount numeric
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit numeric;
  v_plan_id uuid;
BEGIN
  IF p_mint_amount IS NULL OR p_mint_amount <= 0
     OR p_owner_address IS NULL OR length(trim(p_owner_address)) = 0 THEN
    RETURN false;
  END IF;

  SELECT ar.plan_id
    INTO v_plan_id
    FROM public.agent_registry ar
   WHERE ar.id = p_agent_id
     AND lower(ar.owner_address) = lower(p_owner_address);

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF v_plan_id IS NULL THEN
    SELECT ap.max_mint_amount_monthly
      INTO v_limit
      FROM public.agent_plans ap
     WHERE ap.slug = 'free'
     LIMIT 1;
  ELSE
    SELECT ap.max_mint_amount_monthly
      INTO v_limit
      FROM public.agent_plans ap
     WHERE ap.id = v_plan_id;
  END IF;

  -- NULL is the documented unlimited value for Pro and Enterprise.
  IF v_limit IS NULL THEN
    RETURN true;
  END IF;

  -- Reject a single oversized operation before attempting the insert.
  IF p_mint_amount > v_limit THEN
    RETURN false;
  END IF;

  INSERT INTO public.agent_usage (
    owner_address,
    period_start,
    period_end,
    api_calls_count,
    mint_operations_count,
    mint_total_amount,
    plan_id
  )
  VALUES (
    lower(p_owner_address),
    date_trunc('month', current_date)::date,
    (date_trunc('month', current_date) + interval '1 month - 1 day')::date,
    0,
    1,
    p_mint_amount,
    v_plan_id
  )
  ON CONFLICT (owner_address, period_start)
  DO UPDATE SET
    mint_operations_count = coalesce(public.agent_usage.mint_operations_count, 0) + 1,
    mint_total_amount = coalesce(public.agent_usage.mint_total_amount, 0) + p_mint_amount,
    updated_at = now()
  WHERE coalesce(public.agent_usage.mint_total_amount, 0) + p_mint_amount <= v_limit;

  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.consume_agent_mint_quota(uuid, text, numeric) TO service_role;