-- Add 'paused' status to loyalty_programs status check constraint
ALTER TABLE public.loyalty_programs
DROP CONSTRAINT IF EXISTS loyalty_programs_status_check;

ALTER TABLE public.loyalty_programs
ADD CONSTRAINT loyalty_programs_status_check 
CHECK (status IN ('active', 'expired', 'expiring_soon', 'paused'));

-- Update Cofemania program to paused status
UPDATE public.loyalty_programs
SET status = 'paused', updated_at = now()
WHERE name = 'Cofemania' AND merchant_address = '0xf55a2b967ddaa5049f537d8402b791901cc9d34e';