-- Fix: Tighten voucher INSERT policy to prevent fraudulent voucher creation
-- Enforce status='active' and validate reward exists, is active, belongs to merchant, and cost matches

DROP POLICY IF EXISTS "Authenticated customers can create vouchers" ON public.vouchers;

CREATE POLICY "Authenticated customers can create vouchers"
  ON public.vouchers FOR INSERT
  TO authenticated
  WITH CHECK (
    customer_address = (SELECT wallet_address FROM profiles WHERE user_id = auth.uid())
    AND status = 'active'
    AND EXISTS (
      SELECT 1 FROM rewards r
      WHERE r.id = vouchers.reward_id
        AND r.is_active = true
        AND lower(r.merchant_address) = lower(vouchers.merchant_address)
        AND r.cost = vouchers.cost
    )
  );