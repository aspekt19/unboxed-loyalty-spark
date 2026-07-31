-- Column-level hardening: customers may not write system-calculated loyalty metrics.
REVOKE UPDATE ON public.customer_profiles FROM authenticated;
GRANT UPDATE (
  first_name,
  last_name,
  phone,
  email,
  cdp_wallet_address,
  cdp_wallet_created_at,
  updated_at
) ON public.customer_profiles TO authenticated;

GRANT ALL ON public.customer_profiles TO service_role;

-- Re-assert the policy with an explicit WITH CHECK on wallet ownership.
DROP POLICY IF EXISTS "Customers can update own profile" ON public.customer_profiles;
CREATE POLICY "Customers can update own profile"
ON public.customer_profiles
FOR UPDATE
TO authenticated
USING (public.is_current_user_linked_wallet(wallet_address))
WITH CHECK (public.is_current_user_linked_wallet(wallet_address));