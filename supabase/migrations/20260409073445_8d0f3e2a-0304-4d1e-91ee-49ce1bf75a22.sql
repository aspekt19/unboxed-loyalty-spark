
-- Fix DELETE policy: use case-insensitive comparison
DROP POLICY IF EXISTS "Merchants can delete own programs" ON public.loyalty_programs;
CREATE POLICY "Merchants can delete own programs"
  ON public.loyalty_programs
  FOR DELETE
  TO public
  USING (
    lower(merchant_address) = lower((
      SELECT profiles.wallet_address
      FROM profiles
      WHERE profiles.user_id = auth.uid()
    ))
  );

-- Fix UPDATE policy: use case-insensitive comparison
DROP POLICY IF EXISTS "Merchants can update own programs" ON public.loyalty_programs;
CREATE POLICY "Merchants can update own programs"
  ON public.loyalty_programs
  FOR UPDATE
  TO public
  USING (
    lower(merchant_address) = lower((
      SELECT profiles.wallet_address
      FROM profiles
      WHERE profiles.user_id = auth.uid()
    ))
  );
