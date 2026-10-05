-- Coinbase sign-in users own both a smart account and an inner signer wallet; both are
-- verified in identity_links. Let merchants manage programs/rewards from any verified wallet.
DROP POLICY IF EXISTS "Merchants can create programs" ON public.loyalty_programs;
CREATE POLICY "Merchants can create programs" ON public.loyalty_programs
  FOR INSERT TO authenticated
  WITH CHECK (public.is_current_user_linked_wallet(merchant_address));

DROP POLICY IF EXISTS "Merchants can update own programs" ON public.loyalty_programs;
CREATE POLICY "Merchants can update own programs" ON public.loyalty_programs
  FOR UPDATE TO authenticated
  USING (public.is_current_user_linked_wallet(merchant_address))
  WITH CHECK (public.is_current_user_linked_wallet(merchant_address));

DROP POLICY IF EXISTS "Merchants can delete own programs" ON public.loyalty_programs;
CREATE POLICY "Merchants can delete own programs" ON public.loyalty_programs
  FOR DELETE TO authenticated
  USING (public.is_current_user_linked_wallet(merchant_address));

DROP POLICY IF EXISTS "Merchants can view all own programs" ON public.loyalty_programs;
CREATE POLICY "Merchants can view all own programs" ON public.loyalty_programs
  FOR SELECT TO authenticated
  USING (public.is_current_user_linked_wallet(merchant_address) AND status <> 'expired');

DROP POLICY IF EXISTS "Authenticated merchants can create rewards" ON public.rewards;
CREATE POLICY "Authenticated merchants can create rewards" ON public.rewards
  FOR INSERT TO authenticated
  WITH CHECK (public.is_current_user_linked_wallet(merchant_address));

DROP POLICY IF EXISTS "Merchants can update own rewards" ON public.rewards;
CREATE POLICY "Merchants can update own rewards" ON public.rewards
  FOR UPDATE TO authenticated
  USING (public.is_current_user_linked_wallet(merchant_address))
  WITH CHECK (public.is_current_user_linked_wallet(merchant_address));

GRANT EXECUTE ON FUNCTION public.is_current_user_linked_wallet(text) TO authenticated;