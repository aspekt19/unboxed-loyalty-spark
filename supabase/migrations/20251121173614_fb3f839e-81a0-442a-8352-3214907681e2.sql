-- Fix RLS policy for user_roles to avoid infinite recursion
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;

-- Create new policy using the security definer function
CREATE POLICY "Admins can view all roles"
  ON public.user_roles
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));