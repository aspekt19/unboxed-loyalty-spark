import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useState } from 'react';
import { useAccount, useBalance } from 'wagmi';
import { useRoundUp } from '@/hooks/useRoundUp';
import { Send, TrendingUp, Info } from 'lucide-react';
import { isAddress, parseEther, formatEther } from 'viem';
import { z } from 'zod';

const sendSchema = z.object({
  recipient: z.string().refine((val) => isAddress(val), {
    message: "Invalid Ethereum address",
  }),
  amount: z.string().refine((val) => {
    const num = parseFloat(val);
    return !isNaN(num) && num > 0;
  }, {
    message: "Amount must be greater than 0",
  }),
});

export const SendWithRoundUp = () => {
  const { address } = useAccount();
  const { data: balance } = useBalance({ address });
  const { roundUp, isPending } = useRoundUp(address);

  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [errors, setErrors] = useState<{ recipient?: string; amount?: string }>({});

  // Calculate round-up amount
  const calculateRoundUp = (value: string): string => {
    if (!value || parseFloat(value) <= 0) return '0';
    const num = parseFloat(value);
    const rounded = Math.ceil(num * 100) / 100; // Round up to nearest 0.01
    const roundUpAmount = rounded - num;
    return roundUpAmount.toFixed(6);
  };

  const roundUpAmount = calculateRoundUp(amount);
  const totalAmount = amount && parseFloat(amount) > 0 
    ? (parseFloat(amount) + parseFloat(roundUpAmount)).toFixed(6)
    : '0';

  const handleSend = async () => {
    setErrors({});

    // Validate inputs
    const validation = sendSchema.safeParse({ recipient, amount });
    
    if (!validation.success) {
      const fieldErrors: { recipient?: string; amount?: string } = {};
      validation.error.errors.forEach((err) => {
        if (err.path[0] === 'recipient') {
          fieldErrors.recipient = err.message;
        } else if (err.path[0] === 'amount') {
          fieldErrors.amount = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    // Check balance
    if (balance && parseEther(totalAmount) > balance.value) {
      setErrors({ amount: 'Insufficient balance' });
      return;
    }

    try {
      await roundUp(recipient as `0x${string}`, amount);
      setRecipient('');
      setAmount('');
    } catch (error) {
      console.error('Send error:', error);
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-primary/10">
          <Send className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-lg">Send ETH with Round-Up</h3>
          <p className="text-sm text-muted-foreground">
            Transfer ETH and automatically invest the spare change
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Recipient Address */}
        <div className="space-y-2">
          <Label htmlFor="recipient">Recipient Address</Label>
          <Input
            id="recipient"
            placeholder="0x..."
            value={recipient}
            onChange={(e) => {
              setRecipient(e.target.value.trim());
              setErrors((prev) => ({ ...prev, recipient: undefined }));
            }}
            className={errors.recipient ? 'border-destructive' : ''}
          />
          {errors.recipient && (
            <p className="text-xs text-destructive">{errors.recipient}</p>
          )}
        </div>

        {/* Amount */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="amount">Amount (ETH)</Label>
            {balance && (
              <span className="text-xs text-muted-foreground">
                Balance: {parseFloat(formatEther(balance.value)).toFixed(6)} ETH
              </span>
            )}
          </div>
          <Input
            id="amount"
            type="number"
            step="0.001"
            min="0"
            placeholder="0.0"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setErrors((prev) => ({ ...prev, amount: undefined }));
            }}
            className={errors.amount ? 'border-destructive' : ''}
          />
          {errors.amount && (
            <p className="text-xs text-destructive">{errors.amount}</p>
          )}
        </div>

        {/* Round-Up Info */}
        {amount && parseFloat(amount) > 0 && (
          <Alert>
            <TrendingUp className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Sending to recipient:</span>
                  <span className="font-semibold">{amount} ETH</span>
                </div>
                <div className="flex justify-between text-primary">
                  <span>Round-up amount:</span>
                  <span className="font-semibold">+{roundUpAmount} ETH</span>
                </div>
                <div className="flex justify-between border-t pt-1 mt-1">
                  <span>Total from wallet:</span>
                  <span className="font-bold">{totalAmount} ETH</span>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Info Box */}
        <div className="bg-muted/50 p-3 rounded-lg space-y-2">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">
                <strong>How it works:</strong>
              </p>
              <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                <li>Amount is rounded up to nearest 0.01 ETH</li>
                <li>Recipient receives exact amount you specify</li>
                <li>Round-up difference goes to your investment vault</li>
                <li>Gas fees apply to the transaction</li>
              </ul>
            </div>
          </div>
        </div>

        <Button
          className="w-full"
          onClick={handleSend}
          disabled={isPending || !recipient || !amount || parseFloat(amount) <= 0}
        >
          {isPending ? 'Sending...' : 'Send with Round-Up'}
        </Button>
      </div>
    </Card>
  );
};
