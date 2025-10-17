import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useDeployLoyaltyToken } from '@/hooks/useDeployLoyaltyToken';
import { toast } from 'sonner';
import { Loader2, Plus } from 'lucide-react';

export function CreateLoyaltyProgram() {
  const [programName, setProgramName] = useState('');
  const [tokenSymbol, setTokenSymbol] = useState('');
  const { deployToken, isPending, isSuccess } = useDeployLoyaltyToken();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!programName || !tokenSymbol) {
      toast.error('Please fill all fields');
      return;
    }

    deployToken(programName, tokenSymbol);
  };

  // Watch for success and handle post-deployment actions
  if (isSuccess && programName && tokenSymbol) {
    toast.success(`Loyalty program "${programName}" created!`);
    // Save to localStorage for tracking
    const savedPrograms = JSON.parse(localStorage.getItem('loyaltyPrograms') || '[]');
    savedPrograms.push({ name: programName, symbol: tokenSymbol, timestamp: Date.now() });
    localStorage.setItem('loyaltyPrograms', JSON.stringify(savedPrograms));
    setProgramName('');
    setTokenSymbol('');
  }

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
