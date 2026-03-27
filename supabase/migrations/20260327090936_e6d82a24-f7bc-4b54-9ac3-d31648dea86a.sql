DROP POLICY IF EXISTS "Anyone can view payment settings" ON public.payment_settings;

CREATE POLICY "Authenticated users can view payment settings"
ON public.payment_settings
FOR SELECT
TO authenticated
USING (true);