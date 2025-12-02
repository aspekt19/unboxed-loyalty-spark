import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useTransferTokens } from '@/hooks/useTransferTokens';
import { CONTRACTS } from '@/config/contracts';
import { Loader2, ArrowRightLeft, X } from 'lucide-react';

interface MarketplaceOffer {
  id: string;
  creator_address: string;
  offer_token_address: string;
  offer_amount: number;
  request_token_address: string;
  request_amount: number;
  status: string;
  created_at: string;
}

interface TokenInfo {
  address: string;
  name: string;
  symbol: string;
}

export function MarketplaceOffersList() {
  const { address } = useAccount();
  const [offers, setOffers] = useState<MarketplaceOffer[]>([]);
  const [tokens, setTokens] = useState<Record<string, TokenInfo>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [processingOfferId, setProcessingOfferId] = useState<string | null>(null);

  const { transferTokens, isPending, isSuccess } = useTransferTokens();

  useEffect(() => {
    loadTokensInfo();
    loadOffers();

    const handleUpdate = () => {
      loadOffers();
    };

    window.addEventListener('marketplaceOffersUpdated', handleUpdate);

    return () => {
      window.removeEventListener('marketplaceOffersUpdated', handleUpdate);
    };
  }, []);

  const loadTokensInfo = async () => {
    const { data, error } = await supabase
      .from('loyalty_programs')
      .select('token_address, name, symbol');

    if (error) {
      console.error('Error loading tokens:', error);
      return;
    }

    const tokensMap: Record<string, TokenInfo> = {};
    data.forEach(p => {
      tokensMap[p.token_address.toLowerCase()] = {
        address: p.token_address,
        name: p.name,
        symbol: p.symbol,
      };
    });

    setTokens(tokensMap);
  };

  const loadOffers = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('marketplace_offers')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading offers:', error);
      toast.error('Failed to load offers');
      setIsLoading(false);
      return;
    }

    setOffers(data || []);
    setIsLoading(false);
  };

  const handleAcceptOffer = async (offer: MarketplaceOffer) => {
    if (!address) {
      toast.error('Please connect your wallet');
      return;
    }

    if (offer.creator_address.toLowerCase() === address.toLowerCase()) {
      toast.error('Cannot accept your own offer');
      return;
    }

    try {
      setProcessingOfferId(offer.id);

      // Transfer tokens from accepter to creator (direct P2P transfer)
      transferTokens(
        offer.request_token_address,
        offer.creator_address,
        offer.request_amount.toString(),
        CONTRACTS.LOYAL_SPARK_ERC20.abi
      );

      // Wait for transaction to be submitted
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Update offer status
      const { error: updateError } = await supabase
        .from('marketplace_offers')
        .update({
          status: 'completed',
          completed_by: address.toLowerCase(),
          completed_at: new Date().toISOString(),
        })
        .eq('id', offer.id);

      if (updateError) throw updateError;

      toast.success('Exchange completed successfully!');
      
      // Refresh offers
      loadOffers();
      window.dispatchEvent(new CustomEvent('tokenBalancesUpdated'));
    } catch (error) {
      console.error('Error accepting offer:', error);
      toast.error('Failed to complete exchange');
    } finally {
      setProcessingOfferId(null);
    }
  };

  const handleCancelOffer = async (offerId: string) => {
    try {
      const { error } = await supabase
        .from('marketplace_offers')
        .update({ status: 'cancelled' })
        .eq('id', offerId);

      if (error) throw error;

      toast.success('Offer cancelled');
      loadOffers();
    } catch (error) {
      console.error('Error cancelling offer:', error);
      toast.error('Failed to cancel offer');
    }
  };

  const getTokenInfo = (tokenAddress: string) => {
    return tokens[tokenAddress.toLowerCase()];
  };

  const formatAmount = (amount: number) => {
    return amount.toLocaleString('en-US', { maximumFractionDigits: 6 });
  };

  const isOwnOffer = (offer: MarketplaceOffer) => {
    return address && offer.creator_address.toLowerCase() === address.toLowerCase();
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {offers.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-muted-foreground">No active offers available</p>
          </CardContent>
        </Card>
      ) : (
        offers.map((offer) => {
          const offerToken = getTokenInfo(offer.offer_token_address);
          const requestToken = getTokenInfo(offer.request_token_address);

          if (!offerToken || !requestToken) return null;

          return (
            <Card key={offer.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">
                      Exchange Offer
                    </CardTitle>
                    <CardDescription className="text-xs">
                      From: {offer.creator_address.slice(0, 6)}...{offer.creator_address.slice(-4)}
                    </CardDescription>
                  </div>
                  {isOwnOffer(offer) && (
                    <Badge variant="secondary">Your Offer</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex-1 space-y-1 p-3 rounded-lg bg-muted">
                    <p className="text-sm text-muted-foreground">Offering</p>
                    <p className="font-semibold">
                      {formatAmount(offer.offer_amount)} {offerToken.symbol}
                    </p>
                    <p className="text-xs text-muted-foreground">{offerToken.name}</p>
                  </div>

                  <ArrowRightLeft className="h-5 w-5 text-muted-foreground" />

                  <div className="flex-1 space-y-1 p-3 rounded-lg bg-muted">
                    <p className="text-sm text-muted-foreground">Requesting</p>
                    <p className="font-semibold">
                      {formatAmount(offer.request_amount)} {requestToken.symbol}
                    </p>
                    <p className="text-xs text-muted-foreground">{requestToken.name}</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  {isOwnOffer(offer) ? (
                    <Button
                      variant="destructive"
                      className="w-full"
                      onClick={() => handleCancelOffer(offer.id)}
                      disabled={processingOfferId === offer.id}
                    >
                      <X className="mr-2 h-4 w-4" />
                      Cancel Offer
                    </Button>
                  ) : (
                    <Button
                      className="w-full"
                      onClick={() => handleAcceptOffer(offer)}
                      disabled={processingOfferId === offer.id || isPending}
                    >
                      {processingOfferId === offer.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {processingOfferId === offer.id ? 'Exchanging...' : 'Accept Exchange'}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
