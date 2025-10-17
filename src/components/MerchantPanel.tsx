import { CreateLoyaltyProgram } from './CreateLoyaltyProgram';
import { CreatedPrograms } from './CreatedPrograms';
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useMintTokens } from '@/hooks/useMintTokens';
import { toast } from 'sonner';
import { Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function MerchantPanel() {
  const [recipientAddress, setRecipientAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedProgram, setSelectedProgram] = useState<{ name: string; symbol: string; tokenAddress: string } | null>(null);
  const { mintTokens, isPending, isSuccess } = useMintTokens();

  const handleMint = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedProgram) {
      toast.error('Please select a loyalty program first');
      return;
    }
    
    if (!recipientAddress || !amount) {
      toast.error('Please fill all fields');
      return;
    }

    await mintTokens(selectedProgram.tokenAddress, recipientAddress, amount);
  };

  if (isSuccess) {
    toast.success('Tokens minted successfully!');
  }

  return (
    <div className="space-y-6">
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
            <Button type="submit" disabled={isPending || !selectedProgram} className="w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90">
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {selectedProgram ? `Issue ${selectedProgram.symbol}` : 'Issue Tokens'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
