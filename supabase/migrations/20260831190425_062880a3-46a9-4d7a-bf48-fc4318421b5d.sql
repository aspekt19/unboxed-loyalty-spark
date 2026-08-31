REVOKE EXECUTE ON FUNCTION public.consume_agent_mint_quota(uuid, text, numeric) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.consume_agent_mint_quota(uuid, text, numeric) FROM anon;
REVOKE EXECUTE ON FUNCTION public.consume_agent_mint_quota(uuid, text, numeric) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.consume_agent_mint_quota(uuid, text, numeric) TO service_role;