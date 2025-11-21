import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState } from 'react';
import { useAccount } from 'wagmi';
import { useRoundUp } from '@/hooks/useRoundUp';

interface DirectDepositDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const DirectDepositDialog = ({ open, onOpenChange }: DirectDepositDialogProps) => {
  const { address } = useAccount();
  const { directDeposit, isPending } = useRoundUp(address);
  const [amount, setAmount] = useState('');

  const handleDeposit = async () => {
    if (!amount || parseFloat(amount) <= 0) return;
    
    try {
      await directDeposit(amount);
      setAmount('');
      onOpenChange(false);
    } catch (error) {
      console.error('Deposit failed:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Direct Deposit</DialogTitle>
          <DialogDescription>
            Deposit ETH directly to your round-up balance without a transaction
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="amount">Amount (ETH)</Label>
            <Input
              id="amount"
              type="number"
              step="0.001"
              min="0"
              placeholder="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <Button 
            className="w-full" 
            onClick={handleDeposit}
            disabled={isPending || !amount || parseFloat(amount) <= 0}
          >
            {isPending ? 'Depositing...' : 'Deposit ETH'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
