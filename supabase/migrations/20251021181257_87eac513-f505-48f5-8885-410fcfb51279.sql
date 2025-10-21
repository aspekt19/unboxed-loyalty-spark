-- Добавляем политику для мерчантов видеть все свои программы независимо от статуса
CREATE POLICY "Merchants can view all own programs"
ON public.loyalty_programs
FOR SELECT
TO authenticated
USING (
  merchant_address = (
    SELECT profiles.wallet_address
    FROM profiles
    WHERE profiles.user_id = auth.uid()
  )
);