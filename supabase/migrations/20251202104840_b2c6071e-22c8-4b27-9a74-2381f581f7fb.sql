-- Create marketplace_offers table for P2P token exchange
CREATE TABLE IF NOT EXISTS public.marketplace_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_address TEXT NOT NULL,
  offer_token_address TEXT NOT NULL,
  offer_amount NUMERIC NOT NULL CHECK (offer_amount > 0),
  request_token_address TEXT NOT NULL,
  request_amount NUMERIC NOT NULL CHECK (request_amount > 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  completed_by TEXT,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add index for performance
CREATE INDEX idx_marketplace_offers_status ON public.marketplace_offers(status);
CREATE INDEX idx_marketplace_offers_creator ON public.marketplace_offers(creator_address);
CREATE INDEX idx_marketplace_offers_tokens ON public.marketplace_offers(offer_token_address, request_token_address);

-- Enable RLS
ALTER TABLE public.marketplace_offers ENABLE ROW LEVEL SECURITY;

-- Anyone can view active offers
CREATE POLICY "Anyone can view active offers"
ON public.marketplace_offers
FOR SELECT
USING (status = 'active');

-- Creators can view their own offers (all statuses)
CREATE POLICY "Creators can view own offers"
ON public.marketplace_offers
FOR SELECT
USING (creator_address = (SELECT wallet_address FROM profiles WHERE user_id = auth.uid()));

-- Authenticated users can create offers
CREATE POLICY "Authenticated users can create offers"
ON public.marketplace_offers
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL AND
  creator_address = (SELECT wallet_address FROM profiles WHERE user_id = auth.uid())
);

-- Creators can cancel their own active offers
CREATE POLICY "Creators can cancel own offers"
ON public.marketplace_offers
FOR UPDATE
USING (
  creator_address = (SELECT wallet_address FROM profiles WHERE user_id = auth.uid()) AND
  status = 'active'
)
WITH CHECK (status = 'cancelled');

-- Anyone authenticated can complete an offer
CREATE POLICY "Anyone can complete offers"
ON public.marketplace_offers
FOR UPDATE
USING (status = 'active' AND auth.uid() IS NOT NULL)
WITH CHECK (status = 'completed');

-- Trigger to update updated_at
CREATE TRIGGER update_marketplace_offers_updated_at
BEFORE UPDATE ON public.marketplace_offers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();