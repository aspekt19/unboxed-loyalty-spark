-- Обновляем RLS политику для просмотра ваучеров мерчантами
-- Теперь проверяем merchant_address напрямую через профиль текущего пользователя
DROP POLICY IF EXISTS "Merchants can view their vouchers" ON vouchers;

CREATE POLICY "Merchants can view their vouchers"
ON vouchers
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.wallet_address = vouchers.merchant_address
  )
);

-- Аналогично обновляем политику для обновления ваучеров
DROP POLICY IF EXISTS "Merchants can update their vouchers" ON vouchers;

CREATE POLICY "Merchants can update their vouchers"
ON vouchers
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.wallet_address = vouchers.merchant_address
  )
);