-- Align RLS with lowercase merchant_address in app and checksummed profiles.wallet_address
DROP POLICY IF EXISTS "Merchants can create own profile" ON public.merchant_profiles;
DROP POLICY IF EXISTS "Merchants can update own profile" ON public.merchant_profiles;
DROP POLICY IF EXISTS "Merchants can delete own profile" ON public.merchant_profiles;

CREATE POLICY "Merchants can create own profile"
ON public.merchant_profiles
FOR INSERT
TO authenticated
WITH CHECK (
  lower(merchant_address) = lower((
    SELECT profiles.wallet_address
    FROM public.profiles
    WHERE profiles.user_id = auth.uid()
  ))
);

CREATE POLICY "Merchants can update own profile"
ON public.merchant_profiles
FOR UPDATE
TO authenticated
USING (
  lower(merchant_address) = lower((
    SELECT profiles.wallet_address
    FROM public.profiles
    WHERE profiles.user_id = auth.uid()
  ))
);

CREATE POLICY "Merchants can delete own profile"
ON public.merchant_profiles
FOR DELETE
TO authenticated
USING (
  lower(merchant_address) = lower((
    SELECT profiles.wallet_address
    FROM public.profiles
    WHERE profiles.user_id = auth.uid()
  ))
);
