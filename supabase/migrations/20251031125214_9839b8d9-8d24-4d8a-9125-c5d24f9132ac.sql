-- Set REPLICA IDENTITY FULL for vouchers table to ensure complete row data in realtime
ALTER TABLE public.vouchers REPLICA IDENTITY FULL;