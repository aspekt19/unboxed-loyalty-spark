
-- agent_usage
DROP POLICY IF EXISTS "Owners can view own usage" ON public.agent_usage;
CREATE POLICY "Owners can view own usage" ON public.agent_usage FOR SELECT TO authenticated
USING (lower(owner_address) = (SELECT lower(p.wallet_address) FROM public.profiles p WHERE p.user_id = auth.uid()));

-- automation_rules
DROP POLICY IF EXISTS "Merchants can manage own automation rules" ON public.automation_rules;
CREATE POLICY "Merchants can manage own automation rules" ON public.automation_rules FOR ALL TO authenticated
USING (lower(merchant_address) = (SELECT lower(p.wallet_address) FROM public.profiles p WHERE p.user_id = auth.uid()))
WITH CHECK (lower(merchant_address) = (SELECT lower(p.wallet_address) FROM public.profiles p WHERE p.user_id = auth.uid()));

-- automation_triggers_history
DROP POLICY IF EXISTS "Merchants can view own trigger history" ON public.automation_triggers_history;
CREATE POLICY "Merchants can view own trigger history" ON public.automation_triggers_history FOR SELECT TO authenticated
USING (lower(merchant_address) = (SELECT lower(p.wallet_address) FROM public.profiles p WHERE p.user_id = auth.uid()));

-- customer_tier_status
DROP POLICY IF EXISTS "Customers can view own tier status" ON public.customer_tier_status;
CREATE POLICY "Customers can view own tier status" ON public.customer_tier_status FOR SELECT TO authenticated
USING (lower(customer_address) = (SELECT lower(p.wallet_address) FROM public.profiles p WHERE p.user_id = auth.uid()));

DROP POLICY IF EXISTS "Merchants can view customer tier status" ON public.customer_tier_status;
CREATE POLICY "Merchants can view customer tier status" ON public.customer_tier_status FOR SELECT TO authenticated
USING (token_address IN (
  SELECT lp.token_address FROM public.loyalty_programs lp
  WHERE lower(lp.merchant_address) = (SELECT lower(p.wallet_address) FROM public.profiles p WHERE p.user_id = auth.uid())));

-- customer_tiers
DROP POLICY IF EXISTS "Merchants can manage their program tiers" ON public.customer_tiers;
CREATE POLICY "Merchants can manage their program tiers" ON public.customer_tiers FOR ALL TO authenticated
USING (token_address IN (
  SELECT lp.token_address FROM public.loyalty_programs lp
  WHERE lower(lp.merchant_address) = (SELECT lower(p.wallet_address) FROM public.profiles p WHERE p.user_id = auth.uid())))
WITH CHECK (token_address IN (
  SELECT lp.token_address FROM public.loyalty_programs lp
  WHERE lower(lp.merchant_address) = (SELECT lower(p.wallet_address) FROM public.profiles p WHERE p.user_id = auth.uid())));

-- loyalty_programs INSERT
DROP POLICY IF EXISTS "Merchants can create programs" ON public.loyalty_programs;
CREATE POLICY "Merchants can create programs" ON public.loyalty_programs FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL AND lower(merchant_address) = (SELECT lower(p.wallet_address) FROM public.profiles p WHERE p.user_id = auth.uid()));

-- marketing_campaigns
DROP POLICY IF EXISTS "Merchants can manage own campaigns" ON public.marketing_campaigns;
CREATE POLICY "Merchants can manage own campaigns" ON public.marketing_campaigns FOR ALL TO authenticated
USING (lower(merchant_address) = (SELECT lower(p.wallet_address) FROM public.profiles p WHERE p.user_id = auth.uid()))
WITH CHECK (lower(merchant_address) = (SELECT lower(p.wallet_address) FROM public.profiles p WHERE p.user_id = auth.uid()));

-- notification_history
DROP POLICY IF EXISTS "Customers can update own notifications" ON public.notification_history;
CREATE POLICY "Customers can update own notifications" ON public.notification_history FOR UPDATE TO authenticated
USING (lower(customer_address) = (SELECT lower(p.wallet_address) FROM public.profiles p WHERE p.user_id = auth.uid()))
WITH CHECK (lower(customer_address) = (SELECT lower(p.wallet_address) FROM public.profiles p WHERE p.user_id = auth.uid()));

DROP POLICY IF EXISTS "Customers can view own notifications" ON public.notification_history;
CREATE POLICY "Customers can view own notifications" ON public.notification_history FOR SELECT TO authenticated
USING (lower(customer_address) = (SELECT lower(p.wallet_address) FROM public.profiles p WHERE p.user_id = auth.uid()));

DROP POLICY IF EXISTS "Merchants can view own notification history" ON public.notification_history;
CREATE POLICY "Merchants can view own notification history" ON public.notification_history FOR SELECT TO authenticated
USING (campaign_id IN (
  SELECT mc.id FROM public.marketing_campaigns mc
  WHERE lower(mc.merchant_address) = (SELECT lower(p.wallet_address) FROM public.profiles p WHERE p.user_id = auth.uid())));

-- personalized_offers
DROP POLICY IF EXISTS "Customers can view own offers" ON public.personalized_offers;
CREATE POLICY "Customers can view own offers" ON public.personalized_offers FOR SELECT TO authenticated
USING (lower(customer_address) = (SELECT lower(p.wallet_address) FROM public.profiles p WHERE p.user_id = auth.uid()) AND is_active = true);

DROP POLICY IF EXISTS "Merchants can manage own offers" ON public.personalized_offers;
CREATE POLICY "Merchants can manage own offers" ON public.personalized_offers FOR ALL TO authenticated
USING (lower(merchant_address) = (SELECT lower(p.wallet_address) FROM public.profiles p WHERE p.user_id = auth.uid()))
WITH CHECK (lower(merchant_address) = (SELECT lower(p.wallet_address) FROM public.profiles p WHERE p.user_id = auth.uid()));

-- referrals
DROP POLICY IF EXISTS "Merchants can view program referrals" ON public.referrals;
CREATE POLICY "Merchants can view program referrals" ON public.referrals FOR SELECT TO authenticated
USING (lower(merchant_address) = (SELECT lower(p.wallet_address) FROM public.profiles p WHERE p.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can view own referrals" ON public.referrals;
CREATE POLICY "Users can view own referrals" ON public.referrals FOR SELECT TO authenticated
USING (lower(referrer_address) = (SELECT lower(p.wallet_address) FROM public.profiles p WHERE p.user_id = auth.uid()));

-- review_responses
DROP POLICY IF EXISTS "Merchants can create responses" ON public.review_responses;
CREATE POLICY "Merchants can create responses" ON public.review_responses FOR INSERT TO authenticated
WITH CHECK (
  lower(merchant_address) = (SELECT lower(p.wallet_address) FROM public.profiles p WHERE p.user_id = auth.uid())
  AND review_id IN (
    SELECT r.id FROM public.reviews r
    WHERE lower(r.merchant_address) = (SELECT lower(p.wallet_address) FROM public.profiles p WHERE p.user_id = auth.uid())));

DROP POLICY IF EXISTS "Merchants can update own responses" ON public.review_responses;
CREATE POLICY "Merchants can update own responses" ON public.review_responses FOR UPDATE TO authenticated
USING (lower(merchant_address) = (SELECT lower(p.wallet_address) FROM public.profiles p WHERE p.user_id = auth.uid()))
WITH CHECK (lower(merchant_address) = (SELECT lower(p.wallet_address) FROM public.profiles p WHERE p.user_id = auth.uid()));

-- reviews
DROP POLICY IF EXISTS "Customers can create reviews" ON public.reviews;
CREATE POLICY "Customers can create reviews" ON public.reviews FOR INSERT TO authenticated
WITH CHECK (
  lower(customer_address) = (SELECT lower(p.wallet_address) FROM public.profiles p WHERE p.user_id = auth.uid())
  AND voucher_id IN (
    SELECT v.id FROM public.vouchers v
    WHERE lower(v.customer_address) = (SELECT lower(p.wallet_address) FROM public.profiles p WHERE p.user_id = auth.uid())
      AND v.status = 'used'));

DROP POLICY IF EXISTS "Customers can update own reviews" ON public.reviews;
CREATE POLICY "Customers can update own reviews" ON public.reviews FOR UPDATE TO authenticated
USING (lower(customer_address) = (SELECT lower(p.wallet_address) FROM public.profiles p WHERE p.user_id = auth.uid()))
WITH CHECK (lower(customer_address) = (SELECT lower(p.wallet_address) FROM public.profiles p WHERE p.user_id = auth.uid()));

-- token_mint_history
DROP POLICY IF EXISTS "Merchant team can insert mint history" ON public.token_mint_history;
CREATE POLICY "Merchant team can insert mint history" ON public.token_mint_history FOR INSERT TO authenticated
WITH CHECK (public.is_merchant_member(
  (SELECT lower(p.wallet_address) FROM public.profiles p WHERE p.user_id = auth.uid()),
  lower(merchant_address)));

DROP POLICY IF EXISTS "Merchant team can read mint history" ON public.token_mint_history;
CREATE POLICY "Merchant team can read mint history" ON public.token_mint_history FOR SELECT TO authenticated
USING (public.is_merchant_member(
  (SELECT lower(p.wallet_address) FROM public.profiles p WHERE p.user_id = auth.uid()),
  lower(merchant_address)));
