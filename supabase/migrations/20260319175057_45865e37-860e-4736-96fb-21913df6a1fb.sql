-- Fix: restrict voucher INSERT policy to authenticated only
DROP POLICY IF EXISTS "Authenticated customers can create vouchers" ON public.vouchers;
CREATE POLICY "Authenticated customers can create vouchers"
  ON public.vouchers FOR INSERT
  TO authenticated
  WITH CHECK (customer_address = (
    SELECT wallet_address FROM profiles WHERE user_id = auth.uid()
  ));