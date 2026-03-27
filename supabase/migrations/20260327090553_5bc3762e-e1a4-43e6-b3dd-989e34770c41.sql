CREATE POLICY "Customers can view own notifications"
ON public.notification_history
FOR SELECT
TO authenticated
USING (customer_address = (SELECT wallet_address FROM profiles WHERE user_id = auth.uid()));