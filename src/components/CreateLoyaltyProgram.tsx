import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useDeployLoyaltyToken } from '@/hooks/useDeployLoyaltyToken';
import { useAccount } from 'wagmi';
import { toast } from 'sonner';
import { Loader2, Plus } from 'lucide-react';

export function CreateLoyaltyProgram() {
  const { address } = useAccount();
  const [programName, setProgramName] = useState('');
  const [tokenSymbol, setTokenSymbol] = useState('');
  const { deployToken, isPending, isSuccess, deployedTokenAddress } = useDeployLoyaltyToken();
  const savedRef = useRef(false);

  // Очищаем форму при отключении кошелька
  useEffect(() => {
    if (!address) {
      setProgramName('');
      setTokenSymbol('');
    }
  }, [address]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!address) {
      toast.error('Please connect your wallet first');
      return;
    }
    
    if (!programName || !tokenSymbol) {
      toast.error('Please fill all fields');
      return;
    }

    savedRef.current = false;
    deployToken(programName, tokenSymbol);
  };

  // Watch for success and handle post-deployment actions
  useEffect(() => {
    if (isSuccess && programName && tokenSymbol && deployedTokenAddress && !savedRef.current) {
      toast.success(`Loyalty program "${programName}" created!`);
      // Save to localStorage with token address
      const savedPrograms = JSON.parse(localStorage.getItem('loyaltyPrograms') || '[]');
      savedPrograms.push({ 
        name: programName, 
        symbol: tokenSymbol, 
        timestamp: Date.now(),
        tokenAddress: deployedTokenAddress 
      });
      localStorage.setItem('loyaltyPrograms', JSON.stringify(savedPrograms));
      savedRef.current = true;
      
      // Clear form after a short delay to show success
      setTimeout(() => {
        setProgramName('');
        setTokenSymbol('');
      }, 500);
      
      // Trigger a custom event to notify other components
      window.dispatchEvent(new Event('loyaltyProgramsUpdated'));
    }
  }, [isSuccess, programName, tokenSymbol, deployedTokenAddress]);

  return (
    <Card className="border-2 bg-gradient-to-br from-card to-muted/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="h-5 w-5 text-primary" />
          Create Loyalty Program
        </CardTitle>
        <CardDescription>Deploy a new loyalty token on BASE</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="program-name">Program Name</Label>
            <Input
              id="program-name"
              placeholder="e.g., Coffee Shop Rewards"
              value={programName}
              onChange={(e) => setProgramName(e.target.value)}
              disabled={isPending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="token-symbol">Token Symbol</Label>
            <Input
              id="token-symbol"
              placeholder="e.g., COFFEE"
              value={tokenSymbol}
              onChange={(e) => setTokenSymbol(e.target.value.toUpperCase())}
              disabled={isPending}
              maxLength={10}
            />
          </div>
          <Button type="submit" disabled={isPending} className="w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90">
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Deploy Program
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
