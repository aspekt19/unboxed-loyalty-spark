ALTER TABLE public.customer_transactions
  DROP CONSTRAINT customer_transactions_voucher_id_fkey,
  ADD CONSTRAINT customer_transactions_voucher_id_fkey
    FOREIGN KEY (voucher_id) REFERENCES public.vouchers(id) ON DELETE SET NULL;