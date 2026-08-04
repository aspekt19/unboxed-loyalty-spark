DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR (
      COALESCE(is_banned, false) = false
      AND banned_at IS NULL
      AND banned_by IS NULL
      AND ban_reason IS NULL
    )
  )
);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND COALESCE(role, 'user') IN ('user', 'merchant')
  AND COALESCE(is_banned, false) = false
  AND banned_at IS NULL
  AND banned_by IS NULL
  AND ban_reason IS NULL
);