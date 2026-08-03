-- Atomic per-owner monthly API quota (fixes lost increments in read-then-write path).
-- Consumed by supabase/functions/_shared/agent-rate-limit.ts via service_role only.

CREATE OR REPLACE FUNCTION public.consume_agent_monthly_quota(
  p_owner_address text,
  p_max_calls integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner text;
  v_period_start date;
  v_period_end date;
  v_count integer;
BEGIN
  IF p_owner_address IS NULL OR length(trim(p_owner_address)) = 0 THEN
    RAISE EXCEPTION 'p_owner_address required';
  END IF;

  v_owner := lower(trim(p_owner_address));
  v_period_start := date_trunc('month', now())::date;
  v_period_end := (date_trunc('month', now()) + interval '1 month' - interval '1 day')::date;

  INSERT INTO public.agent_usage AS u (
    owner_address,
    period_start,
    period_end,
    api_calls_count,
    mint_operations_count,
    mint_total_amount,
    fees_collected_usdc
  )
  VALUES (v_owner, v_period_start, v_period_end, 1, 0, 0, 0)
  ON CONFLICT (owner_address, period_start)
  DO UPDATE SET
    api_calls_count = coalesce(u.api_calls_count, 0) + 1,
    updated_at = now()
  RETURNING u.api_calls_count INTO v_count;

  -- NULL / non-positive cap = unlimited plan: usage is still counted for reporting.
  IF p_max_calls IS NULL OR p_max_calls <= 0 THEN
    RETURN true;
  END IF;

  RETURN v_count <= p_max_calls;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_agent_monthly_quota(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_agent_monthly_quota(text, integer) TO service_role;
