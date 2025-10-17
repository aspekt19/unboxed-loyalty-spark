import { TokenList } from './TokenList';
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useBurnTokens } from '@/hooks/useBurnTokens';
import { useTokenBalance } from '@/hooks/useTokenBalance';
import { toast } from 'sonner';
import { Loader2, Gift } from 'lucide-react';

export function CustomerPanel() {
  const [redeemAmount, setRedeemAmount] = useState('');
  const { balance, refetch } = useTokenBalance();
  const { burnTokens, isPending, isSuccess } = useBurnTokens();

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!redeemAmount || parseFloat(redeemAmount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    if (parseFloat(redeemAmount) > parseFloat(balance)) {
      toast.error('Insufficient balance');
      return;
    }

    await burnTokens(redeemAmount);
  };

  if (isSuccess) {
    toast.success('Tokens redeemed successfully!');
    refetch();
  }

  return (
    <div className="space-y-6">
      <TokenList />
      
      <Card className="border-2 bg-gradient-to-br from-card to-muted/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-primary" />
            Redeem Rewards
          </CardTitle>
          <CardDescription>Burn tokens to claim rewards from merchants</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRedeem} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="redeem-amount">Redeem Amount</Label>
              <Input
                id="redeem-amount"
                type="number"
                placeholder="Enter amount to redeem"
                value={redeemAmount}
                onChange={(e) => setRedeemAmount(e.target.value)}
                disabled={isPending}
              />
            </div>
            <Button type="submit" disabled={isPending} className="w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90">
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Redeem Tokens
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
