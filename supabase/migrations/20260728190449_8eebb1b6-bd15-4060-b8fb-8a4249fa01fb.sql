CREATE OR REPLACE FUNCTION public.is_current_user_linked_wallet(p_wallet text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_wallet IS NOT NULL
    AND auth.uid() IS NOT NULL
    AND (
      EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.user_id = auth.uid()
          AND lower(p.wallet_address) = lower(p_wallet)
      )
      OR EXISTS (
        SELECT 1
        FROM public.identity_links il
        WHERE il.user_id = auth.uid()
          AND il.link_type = 'wallet'
          AND lower(il.value_normalized) = lower(p_wallet)
      )
    )
$$;

GRANT EXECUTE ON FUNCTION public.is_current_user_linked_wallet(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_current_user_linked_wallet(text) TO service_role;

DROP POLICY IF EXISTS "Customers can view own vouchers" ON public.vouchers;
CREATE POLICY "Customers can view own vouchers"
ON public.vouchers
FOR SELECT
TO authenticated
USING (public.is_current_user_linked_wallet(customer_address));

DROP POLICY IF EXISTS "Authenticated customers can create vouchers" ON public.vouchers;
CREATE POLICY "Authenticated customers can create vouchers"
ON public.vouchers
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_current_user_linked_wallet(customer_address)
  AND status = 'active'
  AND EXISTS (
    SELECT 1
    FROM public.rewards r
    WHERE r.id = vouchers.reward_id
      AND r.is_active = true
      AND lower(r.merchant_address) = lower(vouchers.merchant_address)
      AND r.cost = vouchers.cost
  )
);

DROP POLICY IF EXISTS "Customers can view own transactions" ON public.customer_transactions;
CREATE POLICY "Customers can view own transactions"
ON public.customer_transactions
FOR SELECT
TO authenticated
USING (public.is_current_user_linked_wallet(customer_address));