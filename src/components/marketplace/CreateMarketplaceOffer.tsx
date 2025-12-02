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
import { Loader2, ArrowRightLeft, Users, Info } from 'lucide-react';
import { z } from 'zod';
import { Alert, AlertDescription } from '@/components/ui/alert';

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

export function CreateMarketplaceOffer() {
  const { address } = useAccount();
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [offerTokenAddress, setOfferTokenAddress] = useState('');
  const [offerAmount, setOfferAmount] = useState('');
  const [requestTokenAddress, setRequestTokenAddress] = useState('');
  const [requestAmount, setRequestAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { balances, isLoading: balancesLoading } = useMultiTokenBalance(tokens);

  useEffect(() => {
    loadTokens();
  }, []);

  const loadTokens = async () => {
    const { data, error } = await supabase
      .from('loyalty_programs')
      .select('token_address, name, symbol, merchant_address')
      .in('status', ['active', 'expiring_soon', 'paused']);

    if (error) {
      console.error('Error loading tokens:', error);
      return;
    }

    const tokenList: TokenInfo[] = data.map(p => ({
      address: p.token_address,
      name: p.name,
      symbol: p.symbol,
      merchantAddress: p.merchant_address
    }));

    setTokens(tokenList);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!address) {
      toast.error('Please connect your wallet');
      return;
    }

    try {
      const validatedData = offerSchema.parse({
        offerTokenAddress,
        offerAmount,
        requestTokenAddress,
        requestAmount,
      });

      if (validatedData.offerTokenAddress === validatedData.requestTokenAddress) {
        toast.error('Cannot exchange same tokens');
        return;
      }

      // Check if user has enough balance
      const offerBalance = balances[validatedData.offerTokenAddress.toLowerCase()];
      if (!offerBalance || parseFloat(offerBalance) < parseFloat(validatedData.offerAmount)) {
        toast.error('Insufficient balance');
        return;
      }

      setIsSubmitting(true);

      const { error } = await supabase
        .from('marketplace_offers')
        .insert({
          creator_address: address.toLowerCase(),
          offer_token_address: validatedData.offerTokenAddress.toLowerCase(),
          offer_amount: parseFloat(validatedData.offerAmount),
          request_token_address: validatedData.requestTokenAddress.toLowerCase(),
          request_amount: parseFloat(validatedData.requestAmount),
        });

      if (error) throw error;

      toast.success('Offer created successfully!');
      
      // Reset form
      setOfferTokenAddress('');
      setOfferAmount('');
      setRequestTokenAddress('');
      setRequestAmount('');

      // Trigger refresh
      window.dispatchEvent(new CustomEvent('marketplaceOffersUpdated'));
    } catch (error: any) {
      console.error('Error creating offer:', error);
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error('Failed to create offer');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const getAvailableBalance = (tokenAddress: string) => {
    if (!tokenAddress) return '0';
    return balances[tokenAddress.toLowerCase()] || '0';
  };

  const getTokenInfo = (tokenAddress: string) => {
    return tokens.find(t => t.address.toLowerCase() === tokenAddress.toLowerCase());
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          Create P2P Exchange Offer
        </CardTitle>
        <CardDescription>
          Create a direct peer-to-peer offer - other users will see your offer and can accept it to exchange tokens with you
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Alert className="mb-4 border-blue-500/50 bg-blue-500/5">
          <Info className="h-4 w-4 text-blue-500" />
          <AlertDescription className="text-sm">
            Your offer will be visible to all users. When someone accepts, tokens will be exchanged directly between your wallets.
          </AlertDescription>
        </Alert>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="offerToken">Token You Offer</Label>
            <Select
              value={offerTokenAddress}
              onValueChange={setOfferTokenAddress}
            >
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
            <Label htmlFor="offerAmount">Amount You Offer</Label>
            <Input
              id="offerAmount"
              type="number"
              step="0.000000000000000001"
              placeholder="0.0"
              value={offerAmount}
              onChange={(e) => setOfferAmount(e.target.value)}
              disabled={!offerTokenAddress}
            />
          </div>

          <div className="flex items-center justify-center py-2">
            <ArrowRightLeft className="h-6 w-6 text-muted-foreground rotate-90" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="requestToken">Token You Want</Label>
            <Select
              value={requestTokenAddress}
              onValueChange={setRequestTokenAddress}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select token you want" />
              </SelectTrigger>
              <SelectContent>
                {tokens
                  .filter(t => t.address !== offerTokenAddress)
                  .map((token) => (
                    <SelectItem key={token.address} value={token.address}>
                      {token.name} ({token.symbol})
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="requestAmount">Amount You Want</Label>
            <Input
              id="requestAmount"
              type="number"
              step="0.000000000000000001"
              placeholder="0.0"
              value={requestAmount}
              onChange={(e) => setRequestAmount(e.target.value)}
              disabled={!requestTokenAddress}
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={
              isSubmitting ||
              !offerTokenAddress ||
              !offerAmount ||
              !requestTokenAddress ||
              !requestAmount ||
              balancesLoading
            }
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Offer
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
