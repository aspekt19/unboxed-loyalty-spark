import { Button } from '@/components/ui/button';
import { useWriteContract, useWaitForTransactionReceipt, useAccount } from 'wagmi';
import { ROUND_UP_CONFIG, ROUND_UP_VAULT_ABI } from '@/config/roundup';
import { toast } from 'sonner';
import { useEffect } from 'react';
import { TrendingUp } from 'lucide-react';
import { base } from 'wagmi/chains';

interface InvestButtonProps {
  pendingAmount: number;
  disabled?: boolean;
}

export function InvestButton({ pendingAmount, disabled }: InvestButtonProps) {
  const { address } = useAccount();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  useEffect(() => {
    if (isSuccess) {
      toast.success('Investment successful!', {
        description: 'Your pending round-up has been invested in DeFi protocols',
      });
    }
  }, [isSuccess]);

  useEffect(() => {
    if (error) {
      toast.error('Investment failed', {
        description: error.message,
      });
    }
  }, [error]);

  const handleInvest = async () => {
    if (!address) {
      toast.error('Wallet not connected');
      return;
    }

    try {
      await writeContract({
        address: ROUND_UP_CONFIG.VAULT_ADDRESS as `0x${string}`,
        abi: ROUND_UP_VAULT_ABI,
        functionName: 'invest',
        account: address,
        chain: base,
      } as any);
    } catch (err) {
      console.error('Failed to invest:', err);
    }
  };

  const isButtonDisabled = disabled || pendingAmount === 0 || isPending || isConfirming;

  return (
    <Button
      onClick={handleInvest}
      disabled={isButtonDisabled}
      className="w-full"
      size="lg"
    >
      <TrendingUp className="w-4 h-4 mr-2" />
      {isPending || isConfirming ? 'Investing...' : `Invest $${(pendingAmount * 3400).toFixed(2)}`}
    </Button>
  );
}
