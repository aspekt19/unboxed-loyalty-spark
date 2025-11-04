-- Change default status to 'inactive' for new loyalty programs
ALTER TABLE public.loyalty_programs 
ALTER COLUMN status SET DEFAULT 'inactive';