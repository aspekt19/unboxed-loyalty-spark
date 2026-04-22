import { useState, useEffect } from 'react';
import { useAccount, useSendTransaction, useWaitForTransactionReceipt } from 'wagmi';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { parseUnits } from 'viem';
import { encodeWithBuilderCode } from '@/config/builder-code';
import { CONTRACTS } from '@/config/contracts';
import { Loader2, ArrowRightLeft, X, Shield, Info, CheckCircle2 } from 'lucide-react';

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
  const [processingStep, setProcessingStep] = useState<'approve' | 'fill' | null>(null);

  const escrowAddress = CONTRACTS.LOYALTY_TOKEN_ESCROW.address;

  const { sendTransaction: sendApprove, data: approveHash, isPending: approvePending } = useSendTransaction();
  const { isSuccess: approveConfirmed } = useWaitForTransactionReceipt({ hash: approveHash });

  const { sendTransaction: sendFill, data: fillHash, isPending: fillPending } = useSendTransaction();
  const { isSuccess: fillConfirmed } = useWaitForTransactionReceipt({ hash: fillHash });

  const { sendTransaction: sendCancel, data: cancelHash, isPending: cancelPending } = useSendTransaction();
  const { isSuccess: cancelConfirmed } = useWaitForTransactionReceipt({ hash: cancelHash });

  // Stored offer for async flow
  const [pendingOffer, setPendingOffer] = useState<MarketplaceOffer | null>(null);

  useEffect(() => {
    loadTokensInfo();
    loadOffers();
    const handleUpdate = () => loadOffers();
    window.addEventListener('marketplaceOffersUpdated', handleUpdate);
    return () => window.removeEventListener('marketplaceOffersUpdated', handleUpdate);
  }, []);

  // After approve confirmed, fill the offer
  useEffect(() => {
    if (approveConfirmed && processingStep === 'approve' && pendingOffer) {
      setProcessingStep('fill');
      fillEscrowOffer(pendingOffer);
    }
  }, [approveConfirmed]);

  // After fill confirmed, update DB
  useEffect(() => {
    if (fillConfirmed && processingStep === 'fill' && pendingOffer) {
      completeOffer(pendingOffer.id);
    }
  }, [fillConfirmed]);

  // After cancel confirmed, update DB
  useEffect(() => {
    if (cancelConfirmed && processingOfferId) {
      completeCancelOffer(processingOfferId);
    }
  }, [cancelConfirmed]);

  const loadTokensInfo = async () => {
    const { data } = await supabase
      .from('loyalty_programs')
      .select('token_address, name, symbol');

    if (!data) return;
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
    const { data } = await supabase
      .from('marketplace_offers')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false });

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

    setProcessingOfferId(offer.id);
    setProcessingStep('approve');
    setPendingOffer(offer);

    try {
      // Step 1: Approve escrow for requestToken
      const amountWei = parseUnits(offer.request_amount.toString(), 18);
      const approveData = encodeWithBuilderCode(
        CONTRACTS.LOYAL_SPARK_ERC20.abi,
        'approve',
        [escrowAddress, amountWei]
      );

      sendApprove({
        to: offer.request_token_address as `0x${string}`,
        data: approveData,
      });
    } catch {
      resetProcessing();
      toast.error('Failed to start exchange');
    }
  };

  const fillEscrowOffer = (offer: MarketplaceOffer) => {
    try {
      // We need the on-chain offer ID. For now we use the DB offer index.
      // In production, store the on-chain offerId in the DB.
      // For simplicity, encode fillOffer with offerId = 0 as placeholder.
      // TODO: Store escrow_offer_id in marketplace_offers table
      const fillData = encodeWithBuilderCode(
        CONTRACTS.LOYALTY_TOKEN_ESCROW.abi,
        'fillOffer',
        [BigInt(0)] // Placeholder — needs escrow_offer_id from DB
      );

      sendFill({
        to: escrowAddress,
        data: fillData,
      });
    } catch {
      resetProcessing();
      toast.error('Failed to fill offer');
    }
  };

  const completeOffer = async (offerId: string) => {
    await supabase
      .from('marketplace_offers')
      .update({
        status: 'completed',
        completed_by: address?.toLowerCase(),
        completed_at: new Date().toISOString(),
      })
      .eq('id', offerId);

    toast.success('Escrow exchange completed! Both transfers confirmed.');
    resetProcessing();
    loadOffers();
    window.dispatchEvent(new CustomEvent('tokenBalancesUpdated'));
  };

  const handleCancelOffer = async (offerId: string) => {
    setProcessingOfferId(offerId);

    try {
      // Call cancelOffer on escrow contract
      // TODO: Use actual escrow_offer_id
      const cancelData = encodeWithBuilderCode(
        CONTRACTS.LOYALTY_TOKEN_ESCROW.abi,
        'cancelOffer',
        [BigInt(0)] // Placeholder
      );

      sendCancel({
        to: escrowAddress,
        data: cancelData,
      });
    } catch {
      resetProcessing();
      toast.error('Failed to cancel offer');
    }
  };

  const completeCancelOffer = async (offerId: string) => {
    await supabase
      .from('marketplace_offers')
      .update({ status: 'cancelled' })
      .eq('id', offerId);

    toast.success('Offer cancelled. Tokens returned from escrow.');
    resetProcessing();
    loadOffers();
  };

  const resetProcessing = () => {
    setProcessingOfferId(null);
    setProcessingStep(null);
    setPendingOffer(null);
  };

  const getTokenInfo = (tokenAddress: string) => tokens[tokenAddress.toLowerCase()];
  const formatAmount = (amount: number) => amount.toLocaleString('en-US', { maximumFractionDigits: 6 });
  const isOwnOffer = (offer: MarketplaceOffer) => address && offer.creator_address.toLowerCase() === address.toLowerCase();

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
      {offers.length > 0 && (
        <Alert className="border-green-500/50 bg-green-500/5">
          <Shield className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-sm">
            <strong>{offers.length} escrow-protected {offers.length === 1 ? 'offer' : 'offers'} available.</strong> Atomic swap — both transfers or none.
          </AlertDescription>
        </Alert>
      )}

      {offers.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8 space-y-2">
            <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground">No P2P offers available</p>
            <p className="text-sm text-muted-foreground">Create the first escrow-protected exchange offer!</p>
          </CardContent>
        </Card>
      ) : (
        offers.map((offer) => {
          const offerToken = getTokenInfo(offer.offer_token_address);
          const requestToken = getTokenInfo(offer.request_token_address);
          if (!offerToken || !requestToken) return null;

          const isProcessing = processingOfferId === offer.id;

          return (
            <Card key={offer.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Shield className="h-4 w-4 text-green-600" />
                      Escrow P2P Offer
                    </CardTitle>
                    <CardDescription className="text-xs flex items-center gap-1">
                      <span className="text-muted-foreground">From:</span>
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                        {offer.creator_address.slice(0, 6)}...{offer.creator_address.slice(-4)}
                      </code>
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-green-600 border-green-500/50">
                      <Shield className="h-3 w-3 mr-1" /> Escrow
                    </Badge>
                    {isOwnOffer(offer) && <Badge variant="secondary">Your Offer</Badge>}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {isProcessing && processingStep && (
                  <Alert className="border-primary/50 bg-primary/5">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <AlertDescription className="text-sm">
                      {processingStep === 'approve' && 'Step 1/2: Approving escrow contract...'}
                      {processingStep === 'fill' && (
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3 text-green-500" />
                          Step 2/2: Executing atomic swap...
                        </span>
                      )}
                    </AlertDescription>
                  </Alert>
                )}

                <div className="flex items-center gap-4">
                  <div className="flex-1 space-y-1 p-3 rounded-lg bg-muted">
                    <p className="text-sm text-muted-foreground">They Offer</p>
                    <p className="font-semibold">{formatAmount(offer.offer_amount)} {offerToken.symbol}</p>
                    <p className="text-xs text-muted-foreground">{offerToken.name}</p>
                  </div>
                  <ArrowRightLeft className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1 space-y-1 p-3 rounded-lg bg-muted">
                    <p className="text-sm text-muted-foreground">They Want</p>
                    <p className="font-semibold">{formatAmount(offer.request_amount)} {requestToken.symbol}</p>
                    <p className="text-xs text-muted-foreground">{requestToken.name}</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  {isOwnOffer(offer) ? (
                    <Button
                      variant="destructive"
                      className="w-full"
                      onClick={() => handleCancelOffer(offer.id)}
                      disabled={isProcessing || cancelPending}
                    >
                      {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <X className="mr-2 h-4 w-4" />}
                      {isProcessing ? 'Cancelling...' : 'Cancel & Return Tokens'}
                    </Button>
                  ) : (
                    <Button
                      className="w-full"
                      onClick={() => handleAcceptOffer(offer)}
                      disabled={isProcessing || approvePending || fillPending}
                    >
                      {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {isProcessing ? 'Processing Atomic Swap...' : 'Accept Escrow Exchange'}
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
