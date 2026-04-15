-- Drop old INSERT policy
DROP POLICY IF EXISTS "Merchants can insert own mint history" ON public.token_mint_history;

-- Create new INSERT policy that allows merchant owner OR active employees
CREATE POLICY "Merchant team can insert mint history"
ON public.token_mint_history
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_merchant_member(
    (SELECT wallet_address FROM public.profiles WHERE user_id = auth.uid()),
    merchant_address
  )
);