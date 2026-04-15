
-- Enum for employee roles
CREATE TYPE public.merchant_employee_role AS ENUM ('cashier', 'branch_manager', 'admin');

-- Branches table
CREATE TABLE public.merchant_branches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_address TEXT NOT NULL,
  branch_name TEXT NOT NULL,
  branch_address TEXT,
  phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.merchant_branches ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_merchant_branches_updated_at
  BEFORE UPDATE ON public.merchant_branches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Employees table
CREATE TABLE public.merchant_employees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_address TEXT NOT NULL,
  employee_wallet_address TEXT NOT NULL,
  branch_id UUID REFERENCES public.merchant_branches(id) ON DELETE SET NULL,
  role merchant_employee_role NOT NULL DEFAULT 'cashier',
  display_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  invited_by TEXT,
  joined_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (merchant_address, employee_wallet_address)
);

ALTER TABLE public.merchant_employees ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_merchant_employees_updated_at
  BEFORE UPDATE ON public.merchant_employees
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Invites table
CREATE TABLE public.merchant_invites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_address TEXT NOT NULL,
  invite_code TEXT UNIQUE,
  target_wallet_address TEXT,
  role merchant_employee_role NOT NULL DEFAULT 'cashier',
  branch_id UUID REFERENCES public.merchant_branches(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  used_by TEXT,
  used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.merchant_invites ENABLE ROW LEVEL SECURITY;

-- Add audit columns to token_mint_history
ALTER TABLE public.token_mint_history
  ADD COLUMN IF NOT EXISTS employee_address TEXT,
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.merchant_branches(id) ON DELETE SET NULL;

-- Security definer function to check merchant role
CREATE OR REPLACE FUNCTION public.get_merchant_role(p_wallet_address TEXT, p_merchant_address TEXT)
RETURNS merchant_employee_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.merchant_employees
  WHERE lower(employee_wallet_address) = lower(p_wallet_address)
    AND lower(merchant_address) = lower(p_merchant_address)
    AND is_active = true
  LIMIT 1
$$;

-- Check if wallet is merchant owner or employee
CREATE OR REPLACE FUNCTION public.is_merchant_member(p_wallet_address TEXT, p_merchant_address TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    lower(p_wallet_address) = lower(p_merchant_address)
    OR EXISTS (
      SELECT 1 FROM public.merchant_employees
      WHERE lower(employee_wallet_address) = lower(p_wallet_address)
        AND lower(merchant_address) = lower(p_merchant_address)
        AND is_active = true
    )
$$;

-- RLS policies for merchant_branches
CREATE POLICY "Owners can manage branches"
  ON public.merchant_branches FOR ALL
  TO authenticated
  USING (lower(merchant_address) = lower((SELECT wallet_address FROM profiles WHERE user_id = auth.uid())))
  WITH CHECK (lower(merchant_address) = lower((SELECT wallet_address FROM profiles WHERE user_id = auth.uid())));

CREATE POLICY "Employees can view their branches"
  ON public.merchant_branches FOR SELECT
  TO authenticated
  USING (id IN (
    SELECT branch_id FROM public.merchant_employees
    WHERE lower(employee_wallet_address) = lower((SELECT wallet_address FROM profiles WHERE user_id = auth.uid()))
      AND is_active = true
  ));

CREATE POLICY "Service role full access branches"
  ON public.merchant_branches FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- RLS policies for merchant_employees
CREATE POLICY "Owners can manage employees"
  ON public.merchant_employees FOR ALL
  TO authenticated
  USING (lower(merchant_address) = lower((SELECT wallet_address FROM profiles WHERE user_id = auth.uid())))
  WITH CHECK (lower(merchant_address) = lower((SELECT wallet_address FROM profiles WHERE user_id = auth.uid())));

CREATE POLICY "Employees can view own record"
  ON public.merchant_employees FOR SELECT
  TO authenticated
  USING (lower(employee_wallet_address) = lower((SELECT wallet_address FROM profiles WHERE user_id = auth.uid())));

CREATE POLICY "Service role full access employees"
  ON public.merchant_employees FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- RLS policies for merchant_invites
CREATE POLICY "Owners can manage invites"
  ON public.merchant_invites FOR ALL
  TO authenticated
  USING (lower(merchant_address) = lower((SELECT wallet_address FROM profiles WHERE user_id = auth.uid())))
  WITH CHECK (lower(merchant_address) = lower((SELECT wallet_address FROM profiles WHERE user_id = auth.uid())));

CREATE POLICY "Target can view own invite"
  ON public.merchant_invites FOR SELECT
  TO authenticated
  USING (lower(target_wallet_address) = lower((SELECT wallet_address FROM profiles WHERE user_id = auth.uid())));

CREATE POLICY "Service role full access invites"
  ON public.merchant_invites FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- Index for performance
CREATE INDEX idx_merchant_employees_wallet ON public.merchant_employees (lower(employee_wallet_address));
CREATE INDEX idx_merchant_employees_merchant ON public.merchant_employees (lower(merchant_address));
CREATE INDEX idx_merchant_branches_merchant ON public.merchant_branches (lower(merchant_address));
CREATE INDEX idx_merchant_invites_code ON public.merchant_invites (invite_code) WHERE status = 'pending';
