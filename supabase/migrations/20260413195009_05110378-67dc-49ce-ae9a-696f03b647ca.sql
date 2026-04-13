-- Fix review_responses policies: change from public to authenticated role
DROP POLICY IF EXISTS "Merchants can create responses" ON public.review_responses;
CREATE POLICY "Merchants can create responses"
ON public.review_responses
FOR INSERT
TO authenticated
WITH CHECK (
  (merchant_address = (SELECT profiles.wallet_address FROM profiles WHERE profiles.user_id = auth.uid()))
  AND (review_id IN (SELECT reviews.id FROM reviews WHERE reviews.merchant_address = (SELECT profiles.wallet_address FROM profiles WHERE profiles.user_id = auth.uid())))
);

DROP POLICY IF EXISTS "Merchants can update own responses" ON public.review_responses;
CREATE POLICY "Merchants can update own responses"
ON public.review_responses
FOR UPDATE
TO authenticated
USING (merchant_address = (SELECT profiles.wallet_address FROM profiles WHERE profiles.user_id = auth.uid()));