import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useTokenBalance } from '@/hooks/useTokenBalance';
import { useBurnTokens } from '@/hooks/useBurnTokens';
import { toast } from 'sonner';
import { Loader2, Coins } from 'lucide-react';

export function CustomerPanel() {
  const [redeemAmount, setRedeemAmount] = useState('');
  const { balance, isLoading: balanceLoading, refetch } = useTokenBalance();
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
    <Card>
      <CardHeader>
        <CardTitle>Customer Portal</CardTitle>
        <CardDescription>View and redeem your loyalty tokens</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
          <div className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-primary" />
            <span className="font-medium">Your Balance</span>
          </div>
          <div className="text-2xl font-bold">
            {balanceLoading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              `${parseFloat(balance).toFixed(2)} LSP`
            )}
          </div>
        </div>

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
          <Button type="submit" disabled={isPending || balanceLoading} className="w-full">
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Redeem Tokens
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
