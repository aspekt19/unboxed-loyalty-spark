CREATE POLICY "Merchants can insert own mint history"
ON public.token_mint_history
FOR INSERT
TO authenticated
WITH CHECK (
  lower(merchant_address) = (
    SELECT lower(p.wallet_address)
    FROM profiles p
    WHERE p.user_id = auth.uid()
  )
);