
-- Fix search_path on check_expiring_subscriptions
CREATE OR REPLACE FUNCTION public.check_expiring_subscriptions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  sub_record RECORD;
  days_until_expiry INTEGER;
BEGIN
  FOR sub_record IN 
    SELECT * FROM public.premium_subscriptions 
    WHERE is_active = true 
    AND subscription_status = 'active'
    AND expires_at IS NOT NULL
  LOOP
    days_until_expiry := EXTRACT(DAY FROM (sub_record.expires_at - now()));
    
    IF days_until_expiry <= 7 AND days_until_expiry > 3 THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.premium_expiration_notifications
        WHERE subscription_id = sub_record.id
        AND notification_type = 'warning_7d'
      ) THEN
        INSERT INTO public.premium_expiration_notifications 
          (wallet_address, subscription_id, notification_type)
        VALUES 
          (sub_record.wallet_address, sub_record.id, 'warning_7d');
      END IF;
    END IF;
    
    IF days_until_expiry <= 3 AND days_until_expiry > 0 THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.premium_expiration_notifications
        WHERE subscription_id = sub_record.id
        AND notification_type = 'warning_3d'
      ) THEN
        INSERT INTO public.premium_expiration_notifications 
          (wallet_address, subscription_id, notification_type)
        VALUES 
          (sub_record.wallet_address, sub_record.id, 'warning_3d');
      END IF;
    END IF;
    
    IF days_until_expiry <= 0 THEN
      UPDATE public.premium_subscriptions
      SET is_active = false, subscription_status = 'expired'
      WHERE id = sub_record.id;
      
      IF NOT EXISTS (
        SELECT 1 FROM public.premium_expiration_notifications
        WHERE subscription_id = sub_record.id
        AND notification_type = 'expired'
      ) THEN
        INSERT INTO public.premium_expiration_notifications 
          (wallet_address, subscription_id, notification_type)
        VALUES 
          (sub_record.wallet_address, sub_record.id, 'expired');
      END IF;
    END IF;
  END LOOP;
END;
$function$;

-- Fix search_path on log_premium_activity
CREATE OR REPLACE FUNCTION public.log_premium_activity(p_wallet_address text, p_activity_type text, p_activity_data jsonb DEFAULT '{}'::jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.premium_activity_log (wallet_address, activity_type, activity_data)
  VALUES (p_wallet_address, p_activity_type, p_activity_data);
END;
$function$;

-- Fix search_path on generate_referral_code
CREATE OR REPLACE FUNCTION public.generate_referral_code(p_token_address text, p_referrer_address text)
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
  v_code TEXT;
  v_exists BOOLEAN;
BEGIN
  LOOP
    v_code := upper(substring(md5(random()::text || p_referrer_address || now()::text) from 1 for 6));
    
    SELECT EXISTS(
      SELECT 1 FROM referrals 
      WHERE referral_code = v_code 
        AND token_address = p_token_address
    ) INTO v_exists;
    
    EXIT WHEN NOT v_exists;
  END LOOP;
  
  RETURN v_code;
END;
$function$;

-- Add RLS policy for siwe_nonces (service_role only access)
CREATE POLICY "Service role full access on siwe_nonces"
ON public.siwe_nonces
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Allow anon to insert nonces (needed for SIWE flow before auth)
CREATE POLICY "Anon can insert nonces"
ON public.siwe_nonces
FOR INSERT
TO anon
WITH CHECK (true);

-- Allow anon to select nonces (needed for SIWE verification)
CREATE POLICY "Anon can select nonces"
ON public.siwe_nonces
FOR SELECT
TO anon
USING (true);
