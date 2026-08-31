-- 1. Restrict profiles SELECT policy to authenticated role (defense in depth)
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- 2. Reviews: enforce immutability of sensitive columns in the policy itself
--    (in addition to the prevent_review_field_tamper trigger)
DROP POLICY IF EXISTS "Customers can update own reviews" ON public.reviews;
CREATE POLICY "Customers can update own reviews"
ON public.reviews
FOR UPDATE
TO authenticated
USING (
  lower(customer_address) = (SELECT lower(p.wallet_address) FROM public.profiles p WHERE p.user_id = auth.uid())
)
WITH CHECK (
  lower(customer_address) = (SELECT lower(p.wallet_address) FROM public.profiles p WHERE p.user_id = auth.uid())
  AND rating BETWEEN 1 AND 5
  AND is_verified = (SELECT r.is_verified FROM public.reviews r WHERE r.id = reviews.id)
  AND voucher_id IS NOT DISTINCT FROM (SELECT r.voucher_id FROM public.reviews r WHERE r.id = reviews.id)
  AND lower(merchant_address) = (SELECT lower(r.merchant_address) FROM public.reviews r WHERE r.id = reviews.id)
);