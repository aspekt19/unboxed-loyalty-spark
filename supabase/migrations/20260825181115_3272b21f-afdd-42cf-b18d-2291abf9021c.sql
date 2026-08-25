-- Convert ban-check policies from PERMISSIVE to RESTRICTIVE so they are
-- AND-combined with the other permissive policies instead of OR-combined.

-- gift_certificates
DROP POLICY IF EXISTS "Block banned from creating certificates" ON public.gift_certificates;
CREATE POLICY "Block banned from creating certificates"
ON public.gift_certificates
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (NOT is_current_user_banned());

-- loyalty_programs
DROP POLICY IF EXISTS "Block banned from creating programs" ON public.loyalty_programs;
CREATE POLICY "Block banned from creating programs"
ON public.loyalty_programs
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (NOT is_current_user_banned());

-- marketplace_offers
DROP POLICY IF EXISTS "Block banned from creating offers" ON public.marketplace_offers;
CREATE POLICY "Block banned from creating offers"
ON public.marketplace_offers
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (NOT is_current_user_banned());