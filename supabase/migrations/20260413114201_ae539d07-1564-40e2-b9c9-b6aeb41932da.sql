ALTER TABLE public.loyalty_programs
  ADD COLUMN IF NOT EXISTS cashback_rate numeric NOT NULL DEFAULT 5;