-- Single round-trip atomic nonce consumption for SIWE (recipient-api, agent-register-siwe, siwe-verify).
-- Normalizes case/whitespace so client and DB always agree.

CREATE OR REPLACE FUNCTION public.consume_siwe_nonce(p_nonce text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_out text;
  v_norm text;
BEGIN
  v_norm := lower(trim(p_nonce));
  IF v_norm = '' THEN
    RETURN NULL;
  END IF;

  UPDATE public.siwe_nonces
  SET used = true
  WHERE lower(trim(nonce)) = v_norm
    AND used = false
    AND created_at >= now() - interval '5 minutes'
  RETURNING nonce INTO v_out;

  RETURN v_out;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_siwe_nonce(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_siwe_nonce(text) TO service_role;
