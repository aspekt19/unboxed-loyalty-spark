import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useMultiTokenBalance } from '@/hooks/useMultiTokenBalance';
import { useSendTransaction, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits } from 'viem';
import { encodeWithBuilderCode } from '@/config/builder-code';
import { CONTRACTS } from '@/config/contracts';
import { Loader2, ArrowRightLeft, Shield, Info, CheckCircle2 } from 'lucide-react';
import { z } from 'zod';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useActiveWallet } from '@/contexts/ActiveWalletContext';
import { WalletMismatchBanner } from '@/components/identity/WalletMismatchBanner';

interface TokenInfo {
  address: string;
  name: string;
  symbol: string;
  merchantAddress?: string;
}

const offerSchema = z.object({
  offerTokenAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid token address'),
  offerAmount: z.string().regex(/^\d+(\.\d{1,18})?$/, 'Invalid amount').refine(val => parseFloat(val) > 0, 'Amount must be greater than 0'),
  requestTokenAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid token address'),
  requestAmount: z.string().regex(/^\d+(\.\d{1,18})?$/, 'Invalid amount').refine(val => parseFloat(val) > 0, 'Amount must be greater than 0'),
});

type Step = 'form' | 'approving' | 'creating';

export function CreateMarketplaceOffer() {
  const { address } = useAccount();
  const { isWalletMismatch } = useActiveWallet();
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [offerTokenAddress, setOfferTokenAddress] = useState('');
  const [offerAmount, setOfferAmount] = useState('');
  const [requestTokenAddress, setRequestTokenAddress] = useState('');
  const [requestAmount, setRequestAmount] = useState('');
  const [step, setStep] = useState<Step>('form');

  const { balances, isLoading: balancesLoading } = useMultiTokenBalance(tokens);

  const { sendTransaction: sendApprove, data: approveHash, isPending: approvePending } = useSendTransaction();
  const { isSuccess: approveConfirmed } = useWaitForTransactionReceipt({ hash: approveHash });

  const { sendTransaction: sendCreate, data: createHash, isPending: createPending } = useSendTransaction();
  const { isSuccess: createConfirmed } = useWaitForTransactionReceipt({ hash: createHash });

  const escrowAddress = CONTRACTS.LOYALTY_TOKEN_ESCROW.address;

  useEffect(() => {
    loadTokens();
  }, []);

  // After approve confirmed, create the escrow offer
  useEffect(() => {
    if (approveConfirmed && step === 'approving') {
      setStep('creating');
      createEscrowOffer();
    }
  }, [approveConfirmed]);

  // After create confirmed, save to DB and reset
  useEffect(() => {
    if (createConfirmed && step === 'creating') {
      saveOfferToDB();
    }
  }, [createConfirmed]);

  const loadTokens = async () => {
    const { data, error } = await supabase
      .from('loyalty_programs')
      .select('token_address, name, symbol, merchant_address')
      .in('status', ['active', 'expiring_soon', 'paused']);

    if (error) {
      console.error('Error loading tokens:', error);
      return;
    }

    setTokens(data.map(p => ({
      address: p.token_address,
      name: p.name,
      symbol: p.symbol,
      merchantAddress: p.merchant_address,
    })));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isWalletMismatch) {
      toast.error('Reconnect your primary wallet to sign the swap');
      return;
    }
    if (!address) {
      toast.error('Please connect your wallet');
      return;
    }

    try {
      const validated = offerSchema.parse({ offerTokenAddress, offerAmount, requestTokenAddress, requestAmount });

      if (validated.offerTokenAddress === validated.requestTokenAddress) {
        toast.error('Cannot exchange same tokens');
        return;
      }

      const balance = balances[validated.offerTokenAddress.toLowerCase()];
      if (!balance || parseFloat(balance) < parseFloat(validated.offerAmount)) {
        toast.error('Insufficient balance');
        return;
      }

      // Step 1: Approve escrow contract
      setStep('approving');
      const amountWei = parseUnits(validated.offerAmount, 18);
      const approveData = encodeWithBuilderCode(
        CONTRACTS.LOYAL_SPARK_ERC20.abi,
        'approve',
        [escrowAddress, amountWei]
      );

      sendApprove({
        to: validated.offerTokenAddress as `0x${string}`,
        data: approveData,
      });
    } catch (error: any) {
      setStep('form');
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error('Failed to create offer');
      }
    }
  };

  const createEscrowOffer = () => {
    try {
      const amountOfferWei = parseUnits(offerAmount, 18);
      const amountRequestWei = parseUnits(requestAmount, 18);

      const createData = encodeWithBuilderCode(
        CONTRACTS.LOYALTY_TOKEN_ESCROW.abi,
        'createOffer',
        [offerTokenAddress as `0x${string}`, amountOfferWei, requestTokenAddress as `0x${string}`, amountRequestWei]
      );

      sendCreate({
        to: escrowAddress,
        data: createData,
      });
    } catch {
      setStep('form');
      toast.error('Failed to create escrow offer');
    }
  };

  const saveOfferToDB = async () => {
    try {
      await supabase.from('marketplace_offers').insert({
        creator_address: address!.toLowerCase(),
        offer_token_address: offerTokenAddress.toLowerCase(),
        offer_amount: parseFloat(offerAmount),
        request_token_address: requestTokenAddress.toLowerCase(),
        request_amount: parseFloat(requestAmount),
        status: 'active',
      });

      toast.success('Escrow offer created! Tokens locked in smart contract.');
      setOfferTokenAddress('');
      setOfferAmount('');
      setRequestTokenAddress('');
      setRequestAmount('');
      setStep('form');
      window.dispatchEvent(new CustomEvent('marketplaceOffersUpdated'));
    } catch {
      toast.error('Offer created on-chain but failed to save. Contact support.');
      setStep('form');
    }
  };

  const getAvailableBalance = (tokenAddress: string) => {
    if (!tokenAddress) return '0';
    return balances[tokenAddress.toLowerCase()] || '0';
  };

  const getTokenInfo = (tokenAddress: string) => {
    return tokens.find(t => t.address.toLowerCase() === tokenAddress.toLowerCase());
  };

  const isProcessing = step !== 'form';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          Create Escrow P2P Offer
        </CardTitle>
        <CardDescription>
          Tokens are locked in a smart contract escrow — atomic swap guarantees both parties receive their tokens
        </CardDescription>
      </CardHeader>
      <CardContent>
        <WalletMismatchBanner />
        <Alert className="mb-4 mt-4 border-green-500/50 bg-green-500/5">
          <Shield className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-sm">
            <strong>Escrow Protected:</strong> Your tokens are locked in a smart contract. The swap is atomic — either both transfers happen, or neither does.
          </AlertDescription>
        </Alert>

        {isProcessing && (
          <Alert className="mb-4 border-primary/50 bg-primary/5">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <AlertDescription className="text-sm">
              {step === 'approving' && 'Step 1/2: Approving escrow contract to use your tokens...'}
              {step === 'creating' && (
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                  Step 2/2: Creating escrow offer — locking tokens in contract...
                </span>
              )}
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Token You Offer</Label>
            <Select value={offerTokenAddress} onValueChange={setOfferTokenAddress} disabled={isProcessing}>
              <SelectTrigger>
                <SelectValue placeholder="Select token to offer" />
              </SelectTrigger>
              <SelectContent>
                {tokens.map((token) => (
                  <SelectItem key={token.address} value={token.address}>
                    {token.name} ({token.symbol})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {offerTokenAddress && (
              <p className="text-sm text-muted-foreground">
                Available: {getAvailableBalance(offerTokenAddress)} {getTokenInfo(offerTokenAddress)?.symbol}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Amount You Offer</Label>
            <Input
              type="number"
              step="0.000000000000000001"
              placeholder="0.0"
              value={offerAmount}
              onChange={(e) => setOfferAmount(e.target.value)}
              disabled={!offerTokenAddress || isProcessing}
            />
          </div>

          <div className="flex items-center justify-center py-2">
            <ArrowRightLeft className="h-6 w-6 text-muted-foreground rotate-90" />
          </div>

          <div className="space-y-2">
            <Label>Token You Want</Label>
            <Select value={requestTokenAddress} onValueChange={setRequestTokenAddress} disabled={isProcessing}>
              <SelectTrigger>
                <SelectValue placeholder="Select token you want" />
              </SelectTrigger>
              <SelectContent>
                {tokens.filter(t => t.address !== offerTokenAddress).map((token) => (
                  <SelectItem key={token.address} value={token.address}>
                    {token.name} ({token.symbol})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Amount You Want</Label>
            <Input
              type="number"
              step="0.000000000000000001"
              placeholder="0.0"
              value={requestAmount}
              onChange={(e) => setRequestAmount(e.target.value)}
              disabled={!requestTokenAddress || isProcessing}
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={isProcessing || !offerTokenAddress || !offerAmount || !requestTokenAddress || !requestAmount || balancesLoading || isWalletMismatch}
            title={isWalletMismatch ? 'Reconnect your primary wallet to sign' : undefined}
          >
            {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isWalletMismatch
              ? 'Reconnect primary wallet'
              : isProcessing
                ? 'Processing...'
                : 'Create Escrow Offer'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
