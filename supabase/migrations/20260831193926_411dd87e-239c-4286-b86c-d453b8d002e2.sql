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
  AND is_verified IS NOT DISTINCT FROM (SELECT r.is_verified FROM public.reviews r WHERE r.id = reviews.id)
  AND voucher_id IS NOT DISTINCT FROM (SELECT r.voucher_id FROM public.reviews r WHERE r.id = reviews.id)
  AND lower(merchant_address) IS NOT DISTINCT FROM (SELECT lower(r.merchant_address) FROM public.reviews r WHERE r.id = reviews.id)
);