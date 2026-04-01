-- Drop unnecessary anon policies on siwe_nonces
-- The siwe-nonce edge function uses service_role to insert nonces,
-- and siwe-verify uses service_role to read/update them.
-- Anon access is not needed and creates a DoS attack surface.

DROP POLICY IF EXISTS "Anon can insert nonces" ON public.siwe_nonces;
DROP POLICY IF EXISTS "Anon can select nonces" ON public.siwe_nonces;