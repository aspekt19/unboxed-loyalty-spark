
-- 1) Explicit service_role full access on customer_profiles
DROP POLICY IF EXISTS "Service role full access to customer_profiles" ON public.customer_profiles;
CREATE POLICY "Service role full access to customer_profiles"
ON public.customer_profiles
AS PERMISSIVE
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

GRANT ALL ON public.customer_profiles TO service_role;

-- 2) Scope Realtime publication to publicly-readable rows only
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'loyalty_programs'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.loyalty_programs';
  END IF;
  EXECUTE $sql$ALTER PUBLICATION supabase_realtime ADD TABLE public.loyalty_programs WHERE (status IN ('active','expiring_soon','paused'))$sql$;

  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'rewards'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.rewards';
  END IF;
  EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.rewards WHERE (is_active = true)';
END $$;
