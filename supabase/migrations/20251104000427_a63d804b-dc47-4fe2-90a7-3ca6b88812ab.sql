-- Allow 'inactive' status for loyalty programs
-- Drop existing check constraint if it exists
ALTER TABLE public.loyalty_programs DROP CONSTRAINT IF EXISTS loyalty_programs_status_check;

-- Add updated check constraint with 'inactive' status
ALTER TABLE public.loyalty_programs ADD CONSTRAINT loyalty_programs_status_check 
CHECK (status IN ('active', 'inactive', 'paused', 'expiring_soon', 'expired'));