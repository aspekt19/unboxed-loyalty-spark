import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useState } from 'react';
import { formatEther, parseEther } from 'viem';
import { AlertCircle } from 'lucide-react';

interface WithdrawalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  strategyName: string;
  currentValue: bigint;
  onWithdraw: (amount: bigint) => Promise<void>;
  isPending: boolean;
}

export const WithdrawalDialog = ({
  open,
  onOpenChange,
  strategyName,
  currentValue,
  onWithdraw,
  isPending,
}: WithdrawalDialogProps) => {
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');

  const maxAmount = currentValue;
  const maxAmountEth = formatEther(maxAmount);

  const handleWithdraw = async () => {
    setError('');
    
    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    try {
      const amountWei = parseEther(amount);
      
      if (amountWei > maxAmount) {
        setError(`Amount exceeds available balance (${maxAmountEth} ETH)`);
        return;
      }

      await onWithdraw(amountWei);
      setAmount('');
      onOpenChange(false);
    } catch (error) {
      console.error('Withdrawal error:', error);
      setError('Failed to process withdrawal');
    }
  };

  const handleMaxClick = () => {
    setAmount(maxAmountEth);
    setError('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Withdraw from {strategyName}</DialogTitle>
          <DialogDescription>
            Withdraw your invested funds back to your wallet
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <Label htmlFor="amount">Amount (ETH)</Label>
              <span className="text-muted-foreground">
                Available: {parseFloat(maxAmountEth).toFixed(6)} ETH
              </span>
            </div>
            <div className="flex gap-2">
              <Input
                id="amount"
                type="number"
                step="0.000001"
                min="0"
                max={maxAmountEth}
                placeholder="0.0"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setError('');
                }}
                className="flex-1"
              />
              <Button
                variant="outline"
                onClick={handleMaxClick}
                disabled={maxAmount === 0n}
              >
                MAX
              </Button>
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="bg-muted/50 p-3 rounded-lg space-y-1">
            <p className="text-xs text-muted-foreground">
              • Funds will be returned to your wallet
            </p>
            <p className="text-xs text-muted-foreground">
              • Withdrawal may take a few minutes to process
            </p>
            <p className="text-xs text-muted-foreground">
              • Gas fees will apply
            </p>
          </div>

          <Button
            className="w-full"
            onClick={handleWithdraw}
            disabled={isPending || !amount || parseFloat(amount) <= 0 || maxAmount === 0n}
          >
            {isPending ? 'Processing...' : 'Withdraw ETH'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
