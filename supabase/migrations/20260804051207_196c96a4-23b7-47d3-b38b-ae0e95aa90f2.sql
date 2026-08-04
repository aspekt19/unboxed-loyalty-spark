DROP POLICY IF EXISTS "Merchants can delete own rewards" ON public.rewards;

CREATE POLICY "Merchants can delete own rewards"
ON public.rewards
FOR DELETE
TO authenticated
USING (public.is_current_user_linked_wallet(merchant_address));