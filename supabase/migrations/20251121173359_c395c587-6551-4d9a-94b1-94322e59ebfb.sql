-- Create enum for roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, role)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Only admins can view roles
CREATE POLICY "Admins can view all roles"
  ON public.user_roles
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
  ));

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create function to check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin')
$$;

-- Update payment_settings policies
DROP POLICY IF EXISTS "Anyone can view payment settings" ON public.payment_settings;

CREATE POLICY "Anyone can view payment settings"
  ON public.payment_settings
  FOR SELECT
  USING (true);

CREATE POLICY "Only admins can update payment settings"
  ON public.payment_settings
  FOR UPDATE
  USING (public.is_admin());

-- Add policies for premium_payment_requests admin management
CREATE POLICY "Admins can view all payment requests"
  ON public.premium_payment_requests
  FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Admins can update payment requests"
  ON public.premium_payment_requests
  FOR UPDATE
  USING (public.is_admin());