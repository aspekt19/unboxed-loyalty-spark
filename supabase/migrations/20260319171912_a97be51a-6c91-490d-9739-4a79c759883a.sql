-- Fix: Restrict token_mint_history SELECT to merchant's own records
DROP POLICY IF EXISTS "Merchants can read own mint history" ON public.token_mint_history;

CREATE POLICY "Merchants can read own mint history"
  ON public.token_mint_history FOR SELECT
  TO authenticated
  USING (
    lower(merchant_address) = (
      SELECT lower(p.wallet_address)
      FROM profiles p
      WHERE p.user_id = auth.uid()
    )
  );