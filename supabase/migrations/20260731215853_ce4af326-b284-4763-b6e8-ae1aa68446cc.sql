CREATE TABLE public.agent_fee_obligations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id uuid NOT NULL REFERENCES public.agent_registry(id) ON DELETE CASCADE,
  owner_address text NOT NULL,
  operation text NOT NULL DEFAULT 'mint',
  token_address text NOT NULL,
  recipient_address text NOT NULL,
  mint_amount numeric NOT NULL,
  fee_percent numeric NOT NULL,
  fee_amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  fee_tx_hash text,
  recipient_tx_hash text,
  verification_attempts integer NOT NULL DEFAULT 0,
  last_verified_at timestamp with time zone,
  settled_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT agent_fee_obligations_status_check
    CHECK (status IN ('pending', 'settled', 'failed', 'waived'))
);

CREATE INDEX idx_agent_fee_obligations_agent_status
  ON public.agent_fee_obligations (agent_id, status);
CREATE INDEX idx_agent_fee_obligations_owner_status
  ON public.agent_fee_obligations (owner_address, status);
CREATE INDEX idx_agent_fee_obligations_created
  ON public.agent_fee_obligations (created_at DESC);

GRANT SELECT ON public.agent_fee_obligations TO authenticated;
GRANT ALL ON public.agent_fee_obligations TO service_role;

ALTER TABLE public.agent_fee_obligations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view their own fee obligations"
  ON public.agent_fee_obligations
  FOR SELECT
  TO authenticated
  USING (
    public.is_current_user_linked_wallet(lower(owner_address))
    OR public.is_admin()
  );

CREATE POLICY "Service role manages fee obligations"
  ON public.agent_fee_obligations
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER update_agent_fee_obligations_updated_at
  BEFORE UPDATE ON public.agent_fee_obligations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.agent_outstanding_fee_debt(
  p_agent_id uuid,
  p_grace_minutes integer DEFAULT 60
)
RETURNS TABLE(pending_count integer, pending_fee_total numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(COUNT(*), 0)::integer,
    COALESCE(SUM(fee_amount), 0)::numeric
  FROM public.agent_fee_obligations
  WHERE agent_id = p_agent_id
    AND status = 'pending'
    AND created_at < now() - make_interval(mins => p_grace_minutes);
$$;

REVOKE ALL ON FUNCTION public.agent_outstanding_fee_debt(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.agent_outstanding_fee_debt(uuid, integer) TO service_role;