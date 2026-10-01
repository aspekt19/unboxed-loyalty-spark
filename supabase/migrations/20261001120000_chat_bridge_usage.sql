-- Daily message counters for chat-bridge (OpenServ Concierge cost control).
CREATE TABLE IF NOT EXISTS public.chat_bridge_usage (
  wallet_address text NOT NULL,
  day date NOT NULL,
  message_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (wallet_address, day)
);

ALTER TABLE public.chat_bridge_usage ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.chat_bridge_usage FROM PUBLIC, anon, authenticated;
-- Service role (Edge Functions) retains access via bypassing RLS.
