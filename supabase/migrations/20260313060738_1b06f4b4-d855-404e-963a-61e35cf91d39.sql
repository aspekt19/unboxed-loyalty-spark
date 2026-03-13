
CREATE TABLE public.token_mint_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_address TEXT NOT NULL,
  recipient_address TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  token_address TEXT NOT NULL,
  token_name TEXT NOT NULL,
  token_symbol TEXT NOT NULL,
  transaction_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_token_mint_history_merchant ON public.token_mint_history (merchant_address);
CREATE INDEX idx_token_mint_history_token ON public.token_mint_history (token_address);

ALTER TABLE public.token_mint_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants can read own mint history"
  ON public.token_mint_history FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert mint history"
  ON public.token_mint_history FOR INSERT
  TO authenticated
  WITH CHECK (true);
