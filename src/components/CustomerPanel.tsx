import { TokenList } from './TokenList';
import { DexIntegration } from './DexIntegration';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useBurnTokens } from '@/hooks/useBurnTokens';
import { useMultiTokenBalance } from '@/hooks/useMultiTokenBalance';
import { CONTRACTS } from '@/config/contracts';
import { toast } from 'sonner';
import { Loader2, Gift, AlertCircle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface TokenInfo {
  address: string;
  name: string;
  symbol: string;
}

export function CustomerPanel() {
  const [redeemAmount, setRedeemAmount] = useState('');
  const [selectedTokenAddress, setSelectedTokenAddress] = useState<string>('');
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const { balances, isLoading, refetch } = useMultiTokenBalance(tokens);
  const { burnTokens, isPending, isSuccess } = useBurnTokens();

  // Load created programs from localStorage
  useEffect(() => {
    const loadTokens = () => {
      const savedPrograms = localStorage.getItem('createdPrograms');
      if (savedPrograms) {
        const programs = JSON.parse(savedPrograms);
        setTokens(programs);
        if (programs.length > 0 && !selectedTokenAddress) {
          setSelectedTokenAddress(programs[0].address);
        }
      }
    };

    loadTokens();
    window.addEventListener('loyaltyProgramsUpdated', loadTokens);
    return () => window.removeEventListener('loyaltyProgramsUpdated', loadTokens);
  }, [selectedTokenAddress]);

  // Handle successful redemption
  useEffect(() => {
    if (isSuccess) {
      toast.success('Tokens redeemed successfully!');
      setRedeemAmount('');
      
      setTimeout(() => {
        refetch();
      }, 1000);
    }
  }, [isSuccess, refetch]);

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedTokenAddress) {
      toast.error('Please select a loyalty program');
      return;
    }
    
    if (!redeemAmount || parseFloat(redeemAmount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    const selectedToken = tokens.find(t => t.address === selectedTokenAddress);
    const tokenBalance = balances.find(b => b.address === selectedTokenAddress);
    
    if (!tokenBalance || parseFloat(redeemAmount) > parseFloat(tokenBalance.balance)) {
      toast.error('Insufficient balance');
      return;
    }

    await burnTokens(selectedTokenAddress, redeemAmount, CONTRACTS.LOYAL_SPARK_ERC20.abi);
  };

  const selectedToken = tokens.find(t => t.address === selectedTokenAddress);
  const selectedBalance = balances.find(b => b.address === selectedTokenAddress);

  return (
    <div className="space-y-6">
      <TokenList />
      
      <DexIntegration tokenAddress={CONTRACTS.LOYAL_SPARK_ERC20.address} />
      
      <Card className="border-2 bg-gradient-to-br from-card to-muted/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-primary" />
            Redeem Rewards
          </CardTitle>
          <CardDescription>Burn tokens to claim rewards from merchants</CardDescription>
        </CardHeader>
        <CardContent>
          {tokens.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No loyalty programs available. Ask a merchant to issue you loyalty tokens!
              </AlertDescription>
            </Alert>
          ) : (
            <form onSubmit={handleRedeem} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="loyalty-program">Loyalty Program</Label>
                <Select 
                  value={selectedTokenAddress} 
                  onValueChange={setSelectedTokenAddress}
                  disabled={isPending || isLoading}
                >
                  <SelectTrigger id="loyalty-program">
                    <SelectValue placeholder="Select a program" />
                  </SelectTrigger>
                  <SelectContent>
                    {tokens.map((token) => {
                      const balance = balances.find(b => b.address === token.address);
                      return (
                        <SelectItem key={token.address} value={token.address}>
                          {token.name} ({token.symbol}) - Balance: {balance?.balance || '0'}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              
              {selectedToken && selectedBalance && (
                <div className="text-sm text-muted-foreground">
                  Available: {selectedBalance.balance} {selectedToken.symbol}
                </div>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="redeem-amount">Redeem Amount</Label>
                <Input
                  id="redeem-amount"
                  type="number"
                  placeholder="Enter amount to redeem"
                  value={redeemAmount}
                  onChange={(e) => setRedeemAmount(e.target.value)}
                  disabled={isPending || isLoading}
                />
              </div>
              
              <Button 
                type="submit" 
                disabled={isPending || isLoading || !selectedTokenAddress} 
                className="w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90"
              >
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {selectedToken ? `Redeem ${selectedToken.symbol}` : 'Redeem Tokens'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
