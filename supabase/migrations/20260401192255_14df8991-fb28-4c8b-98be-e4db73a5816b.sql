
-- 1. Block any INSERT into user_roles except by service_role (handled by trigger)
-- RLS is already enabled; we just need to ensure no authenticated user can insert
CREATE POLICY "Only service_role can insert roles"
  ON public.user_roles FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Block authenticated users from inserting
CREATE POLICY "Block authenticated insert on user_roles"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (false);

-- Block authenticated users from updating roles
CREATE POLICY "Block authenticated update on user_roles"
  ON public.user_roles FOR UPDATE
  TO authenticated
  USING (false);

-- Block authenticated users from deleting roles  
CREATE POLICY "Block authenticated delete on user_roles"
  ON public.user_roles FOR DELETE
  TO authenticated
  USING (false);

-- 2. Drop customer_email column from notification_history to prevent PII exposure
ALTER TABLE public.notification_history DROP COLUMN IF EXISTS customer_email;
