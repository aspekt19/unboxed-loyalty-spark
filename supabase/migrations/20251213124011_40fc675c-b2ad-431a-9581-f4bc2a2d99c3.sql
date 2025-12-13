-- Fix #1: Customer data exposure to merchants
-- Drop and recreate the policy to only allow merchants to see wallet_address (not PII like email, phone, names)

-- First, we need to create a secure view for merchant access to customer data
-- that masks sensitive PII fields

-- Create a function to mask email (e.g., j***@email.com)
CREATE OR REPLACE FUNCTION public.mask_email(email text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT CASE 
    WHEN email IS NULL OR email = '' THEN NULL
    WHEN position('@' in email) > 0 THEN 
      CONCAT(
        LEFT(email, 1), 
        '***@', 
        SPLIT_PART(email, '@', 2)
      )
    ELSE '***'
  END
$$;

-- Create a function to mask phone (e.g., ***-**-1234)
CREATE OR REPLACE FUNCTION public.mask_phone(phone text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT CASE 
    WHEN phone IS NULL OR phone = '' THEN NULL
    WHEN LENGTH(phone) >= 4 THEN 
      CONCAT('***-**-', RIGHT(phone, 4))
    ELSE '***'
  END
$$;

-- Drop the vulnerable RLS policy that exposes full customer data to merchants
DROP POLICY IF EXISTS "Merchants can view their customers" ON public.customer_profiles;

-- Create a new secure policy that only exposes wallet_address and rfm_score to merchants
-- PII fields (email, phone, first_name, last_name) are protected at the column level
-- We'll use a view for merchants to access masked data instead

-- Create a secure view for merchant access to customer data with masked PII
CREATE OR REPLACE VIEW public.merchant_customer_view
WITH (security_invoker = true)
AS 
SELECT 
  cp.id,
  cp.wallet_address,
  public.mask_email(cp.email) as email,
  public.mask_phone(cp.phone) as phone,
  CASE 
    WHEN cp.first_name IS NOT NULL THEN LEFT(cp.first_name, 1) || '***' 
    ELSE NULL 
  END as first_name,
  NULL::text as last_name, -- Completely hide last name from merchants
  cp.rfm_score,
  cp.total_purchases,
  cp.total_spent,
  cp.last_purchase_date,
  cp.created_at,
  cp.updated_at,
  v.merchant_address
FROM customer_profiles cp
INNER JOIN (
  SELECT DISTINCT customer_address, merchant_address 
  FROM vouchers
) v ON cp.wallet_address = v.customer_address;

-- Now create a more restrictive policy for direct customer_profiles access
-- Merchants can only see aggregate stats, not individual PII
CREATE POLICY "Merchants can view masked customer data via view"
ON public.customer_profiles
FOR SELECT
USING (
  -- Customer can see their own full profile
  wallet_address = (SELECT profiles.wallet_address FROM profiles WHERE profiles.user_id = auth.uid())
);

-- Fix #2: Secure the migrate_wallet_profile function
-- Add validation that only the connected wallet can migrate its own profile

-- Drop the existing function and recreate with security checks
DROP FUNCTION IF EXISTS public.migrate_wallet_profile(text, uuid);

CREATE OR REPLACE FUNCTION public.migrate_wallet_profile(p_wallet_address text, p_new_user_id uuid)
RETURNS TABLE(profile_id uuid, profile_user_id uuid, profile_wallet_address text, profile_role text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
  v_calling_user_id uuid;
BEGIN
  -- SECURITY CHECK: Verify the calling user is the same as p_new_user_id
  -- This prevents attackers from migrating other users' profiles to their session
  v_calling_user_id := auth.uid();
  
  IF v_calling_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  IF v_calling_user_id != p_new_user_id THEN
    RAISE EXCEPTION 'Cannot migrate profile for a different user';
  END IF;
  
  -- Check if a profile already exists for this user_id with a DIFFERENT wallet
  -- This prevents session hijacking by ensuring one user can only have one profile
  PERFORM 1 FROM public.profiles 
  WHERE user_id = p_new_user_id 
    AND LOWER(wallet_address) != LOWER(p_wallet_address);
  
  IF FOUND THEN
    RAISE EXCEPTION 'User already has a profile with a different wallet address';
  END IF;

  -- First, delete any profile that might already exist for the new user_id
  DELETE FROM public.profiles pr WHERE pr.user_id = p_new_user_id;
  
  -- Update existing profile with the new user_id, or insert if doesn't exist
  INSERT INTO public.profiles (user_id, wallet_address, created_at, updated_at)
  VALUES (p_new_user_id, LOWER(p_wallet_address), NOW(), NOW())
  ON CONFLICT (wallet_address) 
  DO UPDATE SET 
    user_id = p_new_user_id,
    updated_at = NOW()
  RETURNING public.profiles.id INTO v_profile_id;
  
  -- Return the profile data directly (bypasses RLS since we're in SECURITY DEFINER)
  RETURN QUERY
  SELECT pr.id, pr.user_id, pr.wallet_address, pr.role
  FROM public.profiles pr
  WHERE pr.id = v_profile_id;
END;
$$;

-- Fix #3: Add transaction_hash column to vouchers table for verification
ALTER TABLE public.vouchers 
ADD COLUMN IF NOT EXISTS transaction_hash text;

-- Add index for looking up vouchers by transaction hash
CREATE INDEX IF NOT EXISTS idx_vouchers_transaction_hash 
ON public.vouchers(transaction_hash) 
WHERE transaction_hash IS NOT NULL;

-- Fix #4: Fix the Security Definer View issue
-- The merchant_analytics view should use SECURITY INVOKER
DROP VIEW IF EXISTS public.merchant_analytics;

CREATE VIEW public.merchant_analytics
WITH (security_invoker = true)
AS 
SELECT lp.merchant_address,
    lp.token_address,
    lp.name AS program_name,
    lp.symbol AS token_symbol,
    count(DISTINCT v.customer_address) AS total_customers,
    count(DISTINCT
        CASE
            WHEN (v.activated_at > (now() - '30 days'::interval)) THEN v.customer_address
            ELSE NULL::text
        END) AS active_customers_30d,
    count(DISTINCT
        CASE
            WHEN (v.activated_at > (now() - '7 days'::interval)) THEN v.customer_address
            ELSE NULL::text
        END) AS active_customers_7d,
    count(v.id) AS total_vouchers_issued,
    count(
        CASE
            WHEN (v.status = 'used'::text) THEN 1
            ELSE NULL::integer
        END) AS vouchers_redeemed,
    sum(v.cost) AS total_tokens_spent,
    avg(v.cost) AS avg_voucher_cost,
    count(
        CASE
            WHEN (v.activated_at > (now() - '30 days'::interval)) THEN 1
            ELSE NULL::integer
        END) AS vouchers_last_30d,
    lp.created_at AS program_created_at
   FROM (loyalty_programs lp
     LEFT JOIN vouchers v ON ((v.token_address = lp.token_address)))
  GROUP BY lp.merchant_address, lp.token_address, lp.name, lp.symbol, lp.created_at;