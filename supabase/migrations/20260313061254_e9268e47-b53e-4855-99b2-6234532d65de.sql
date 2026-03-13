
CREATE TABLE public.blockchain_sync_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_address TEXT NOT NULL UNIQUE,
  last_synced_block BIGINT NOT NULL DEFAULT 0,
  last_synced_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_blockchain_sync_token ON public.blockchain_sync_status (token_address);

ALTER TABLE public.blockchain_sync_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only"
  ON public.blockchain_sync_status FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
