-- Enable REPLICA IDENTITY FULL for vouchers table to ensure realtime filters work properly
ALTER TABLE public.vouchers REPLICA IDENTITY FULL;