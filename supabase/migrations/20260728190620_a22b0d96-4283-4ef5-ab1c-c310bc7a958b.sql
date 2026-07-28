REVOKE ALL ON FUNCTION public.is_current_user_linked_wallet(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_current_user_linked_wallet(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_current_user_linked_wallet(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_current_user_linked_wallet(text) TO service_role;