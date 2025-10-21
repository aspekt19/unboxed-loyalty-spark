import { CreateLoyaltyProgram } from './CreateLoyaltyProgram';
import { CreatedPrograms } from './CreatedPrograms';
import { CreateReward } from './rewards/CreateReward';
import { RewardsList } from './rewards/RewardsList';
import { VouchersManagement } from './rewards/VouchersManagement';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useMintTokens } from '@/hooks/useMintTokens';
import { useAccount } from 'wagmi';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Loader2, Sparkles, AlertCircle, Wallet, AlertTriangle } from 'lucide-react';
import { useCheckProgramStatus } from '@/hooks/useCheckProgramStatus';

export function MerchantPanel() {
  const { address } = useAccount();
  const { session, signInWithWallet, isLoading: authLoading } = useAuth();
  const [recipientAddress, setRecipientAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedProgram, setSelectedProgram] = useState<{ name: string; symbol: string; tokenAddress: string } | null>(null);
  const { mintTokens, isPending, isSuccess, reset } = useMintTokens();
  
  const { isPaused, isMintingActive, isUtilityActive } = useCheckProgramStatus(
    selectedProgram?.tokenAddress as `0x${string}` | undefined
  );

  // Автоматическая аутентификация при подключении кошелька
  useEffect(() => {
    if (address && !session && !authLoading) {
      console.log('Auto-signing in merchant wallet...');
      signInWithWallet();
    }
  }, [address, session, authLoading]);

  // Сбрасываем выбранную программу при отключении кошелька
  useEffect(() => {
    if (!address) {
      setSelectedProgram(null);
      setRecipientAddress('');
      setAmount('');
    }
  }, [address]);

  const handleMint = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedProgram) {
      toast.error('Please select a loyalty program first');
      return;
    }

    if (isPaused || !isMintingActive) {
      toast.error('Please activate the program first before issuing tokens');
      return;
    }
    
    if (!recipientAddress || !amount) {
      toast.error('Please fill all fields');
      return;
    }

    await mintTokens(selectedProgram.tokenAddress, recipientAddress, amount);
  };

  useEffect(() => {
    if (isSuccess) {
      toast.success('Tokens minted successfully!');
      setRecipientAddress('');
      setAmount('');
      // Trigger event to refresh token lists on customer side
      window.dispatchEvent(new Event('loyaltyProgramsUpdated'));
      // Reset the transaction state after a brief delay
      setTimeout(() => {
        reset();
      }, 2000);
    }
  }, [isSuccess, reset]);

  return (
    <div className="space-y-6">
      {!address ? (
        <Alert>
          <Wallet className="h-4 w-4" />
          <AlertDescription>
            Please connect your wallet to access the merchant panel
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <CreateLoyaltyProgram />
          
          <CreatedPrograms onSelectProgram={setSelectedProgram} />
          
          <Card className="border-2 bg-gradient-to-br from-card to-muted/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Issue Rewards
              </CardTitle>
              <CardDescription>Distribute loyalty tokens to customers</CardDescription>
            </CardHeader>
            <CardContent>
              {!selectedProgram && (
                <Alert className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Please select a loyalty program above before issuing rewards
                  </AlertDescription>
                </Alert>
              )}
              
              {selectedProgram && (isPaused || !isMintingActive) && (
                <Alert variant="destructive" className="mb-4">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    This program is currently inactive. Please activate it using the play button in the Created Programs section before issuing tokens.
                  </AlertDescription>
                </Alert>
              )}
              
              <form onSubmit={handleMint} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="recipient">Customer Wallet Address</Label>
                  <Input
                    id="recipient"
                    placeholder="0x..."
                    value={recipientAddress}
                    onChange={(e) => setRecipientAddress(e.target.value)}
                    disabled={isPending}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amount">Token Amount</Label>
                  <Input
                    id="amount"
                    type="number"
                    placeholder="100"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    disabled={isPending}
                  />
                </div>
                <Button 
                  type="submit" 
                  disabled={isPending || !selectedProgram || isPaused || !isMintingActive} 
                  className="w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90"
                >
                  {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {selectedProgram ? `Issue ${selectedProgram.symbol}` : 'Issue Tokens'}
                </Button>
              </form>
            </CardContent>
          </Card>

          <CreateReward />
          
          <RewardsList />
          
          <VouchersManagement />
        </>
      )}
    </div>
  );
}
