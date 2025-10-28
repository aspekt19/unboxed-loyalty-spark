-- Drop existing policy
DROP POLICY IF EXISTS "Merchants can view all own programs" ON public.loyalty_programs;

-- Create policy for anonymous users (who authenticate with wallet)
CREATE POLICY "Merchants can view all own programs"
ON public.loyalty_programs
FOR SELECT
TO anon, authenticated
USING (
  lower(merchant_address) = lower((
    SELECT wallet_address
    FROM public.profiles
    WHERE user_id = auth.uid()
  ))
  AND status <> 'expired'
);