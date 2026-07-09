-- 1) Add column with default 'erc20' → all existing rows become 'erc20' at column add time (no UPDATE, no publication issue)
ALTER TABLE public.loyalty_programs
  ADD COLUMN IF NOT EXISTS token_standard text NOT NULL DEFAULT 'erc20';

-- 2) Change default so all future inserts are 'b20'
ALTER TABLE public.loyalty_programs
  ALTER COLUMN token_standard SET DEFAULT 'b20';

-- 3) Constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'loyalty_programs_token_standard_check'
  ) THEN
    ALTER TABLE public.loyalty_programs
      ADD CONSTRAINT loyalty_programs_token_standard_check
      CHECK (token_standard IN ('erc20','b20'));
  END IF;
END$$;

-- 4) Index for filtering
CREATE INDEX IF NOT EXISTS idx_loyalty_programs_token_standard
  ON public.loyalty_programs (token_standard);