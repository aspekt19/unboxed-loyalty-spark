-- Drop existing RLS policy
DROP POLICY IF EXISTS "Merchants can view all own programs" ON public.loyalty_programs;

-- Create new policy with case-insensitive address comparison
CREATE POLICY "Merchants can view all own programs"
ON public.loyalty_programs
FOR SELECT
USING (
  lower(merchant_address) = lower((
    SELECT wallet_address
    FROM public.profiles
    WHERE user_id = auth.uid()
  ))
  AND status <> 'expired'
);