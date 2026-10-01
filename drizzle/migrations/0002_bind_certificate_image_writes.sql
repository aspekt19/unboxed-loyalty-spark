DROP POLICY IF EXISTS "Merchants upload own certificate images" ON storage.objects;
DROP POLICY IF EXISTS "Merchants update own certificate images" ON storage.objects;
DROP POLICY IF EXISTS "Merchants delete own certificate images" ON storage.objects;

CREATE POLICY "Merchants upload own certificate images" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'certificate-images'
  AND (select auth.uid()) IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = (select auth.uid())
              AND lower(p.wallet_address) = lower((storage.foldername(name))[1]))
);

CREATE POLICY "Merchants update own certificate images" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'certificate-images'
  AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = (select auth.uid())
              AND lower(p.wallet_address) = lower((storage.foldername(name))[1]))
)
WITH CHECK (
  bucket_id = 'certificate-images'
  AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = (select auth.uid())
              AND lower(p.wallet_address) = lower((storage.foldername(name))[1]))
);

CREATE POLICY "Merchants delete own certificate images" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'certificate-images'
  AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = (select auth.uid())
              AND lower(p.wallet_address) = lower((storage.foldername(name))[1]))
);