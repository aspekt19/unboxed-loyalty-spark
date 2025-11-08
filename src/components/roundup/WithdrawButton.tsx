import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useWriteContract, useWaitForTransactionReceipt, useAccount } from 'wagmi';
import { ROUND_UP_CONFIG, ROUND_UP_VAULT_ABI } from '@/config/roundup';
import { parseEther } from 'viem';
import { toast } from 'sonner';
import { useEffect } from 'react';
import { ArrowDownToLine } from 'lucide-react';
import { base } from 'wagmi/chains';

interface WithdrawButtonProps {
  investedAmount: number;
  disabled?: boolean;
}

export function WithdrawButton({ investedAmount, disabled }: WithdrawButtonProps) {
  const [open, setOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const { address } = useAccount();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  useEffect(() => {
    if (isSuccess) {
      toast.success('Withdrawal successful!', {
        description: 'Your funds have been returned to your wallet',
      });
      setOpen(false);
      setWithdrawAmount('');
    }
  }, [isSuccess]);

  useEffect(() => {
    if (error) {
      toast.error('Withdrawal failed', {
        description: error.message,
      });
    }
  }, [error]);

  const handleWithdraw = async () => {
    if (!address) {
      toast.error('Wallet not connected');
      return;
    }

    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) {
      toast.error('Invalid amount');
      return;
    }

    try {
      const amountInWei = parseEther(withdrawAmount);
      await writeContract({
        address: ROUND_UP_CONFIG.VAULT_ADDRESS as `0x${string}`,
        abi: ROUND_UP_VAULT_ABI,
        functionName: 'withdraw',
        args: [amountInWei],
        account: address,
        chain: base,
      } as any);
    } catch (err) {
      console.error('Failed to withdraw:', err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled || investedAmount === 0}
          className="w-full"
          size="lg"
        >
          <ArrowDownToLine className="w-4 h-4 mr-2" />
          Withdraw Funds
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Withdraw from Investment</DialogTitle>
          <DialogDescription>
            Available to withdraw: {investedAmount.toFixed(6)} ETH (${(investedAmount * 3400).toFixed(2)})
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="amount">Amount (ETH)</Label>
            <Input
              id="amount"
              type="number"
              step="0.000001"
              placeholder="0.0"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              max={investedAmount}
            />
          </div>
          <Button
            onClick={() => setWithdrawAmount(investedAmount.toString())}
            variant="outline"
            size="sm"
            className="w-full"
          >
            Max
          </Button>
        </div>
        <Button
          onClick={handleWithdraw}
          disabled={isPending || isConfirming || !withdrawAmount}
          className="w-full"
        >
          {isPending || isConfirming ? 'Processing...' : 'Confirm Withdrawal'}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
