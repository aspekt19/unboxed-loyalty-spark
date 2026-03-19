-- Fix: Restrict voucher policies to authenticated role only (remove anonymous access)

-- Drop and recreate SELECT policy for customers
DROP POLICY IF EXISTS "Customers can view own vouchers" ON public.vouchers;
CREATE POLICY "Customers can view own vouchers"
  ON public.vouchers FOR SELECT
  TO authenticated
  USING (customer_address = (
    SELECT profiles.wallet_address FROM profiles WHERE profiles.user_id = auth.uid()
  ));

-- Drop and recreate UPDATE policy for merchants
DROP POLICY IF EXISTS "Merchants can update their vouchers" ON public.vouchers;
CREATE POLICY "Merchants can update their vouchers"
  ON public.vouchers FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
      AND profiles.wallet_address = vouchers.merchant_address
  ));

-- Drop and recreate SELECT policy for merchants
DROP POLICY IF EXISTS "Merchants can view their vouchers" ON public.vouchers;
CREATE POLICY "Merchants can view their vouchers"
  ON public.vouchers FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
      AND profiles.wallet_address = vouchers.merchant_address
  ));