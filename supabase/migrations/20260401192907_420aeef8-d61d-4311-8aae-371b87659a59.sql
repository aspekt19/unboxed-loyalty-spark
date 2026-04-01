
-- Fix: Tighten marketplace_offers UPDATE policy to prevent arbitrary completed_by
DROP POLICY IF EXISTS "Anyone can complete offers" ON public.marketplace_offers;

CREATE POLICY "Authenticated users can complete active offers"
  ON public.marketplace_offers FOR UPDATE
  TO authenticated
  USING (
    status = 'active'
    AND creator_address <> (SELECT wallet_address FROM profiles WHERE user_id = auth.uid())
  )
  WITH CHECK (
    status = 'completed'
    AND completed_by = (SELECT wallet_address FROM profiles WHERE user_id = auth.uid())
  );
