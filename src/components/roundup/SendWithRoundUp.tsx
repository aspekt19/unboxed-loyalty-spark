import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useState, useEffect } from 'react';
import { useAccount, useBalance } from 'wagmi';
import { useRoundUp } from '@/hooks/useRoundUp';
import { Send, TrendingUp, Info, Loader2 } from 'lucide-react';
import { parseEther, formatEther } from 'viem';
import { z } from 'zod';
import { toast } from 'sonner';
import { RecipientInput, type RecipientInputType } from '@/components/shared/RecipientInput';
import { useResolveRecipient } from '@/hooks/useResolveRecipient';

const amountSchema = z.string().refine((val) => {
  const num = parseFloat(val);
  return !isNaN(num) && num > 0;
}, {
  message: "Amount must be greater than 0",
});

export const SendWithRoundUp = () => {
  const { address } = useAccount();
  const { data: balance } = useBalance({ address });
  const { roundUp, isPending } = useRoundUp(address);

  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [errors, setErrors] = useState<{ recipient?: string; amount?: string }>({});
  const [ethPriceUsd, setEthPriceUsd] = useState<number>(0);
  const [loadingPrice, setLoadingPrice] = useState(true);

  // Fetch ETH price in USD
  useEffect(() => {
    const fetchEthPrice = async () => {
      try {
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
        const data = await response.json();
        setEthPriceUsd(data.ethereum.usd);
        setLoadingPrice(false);
      } catch (error) {
        console.error('Failed to fetch ETH price:', error);
        toast.error('Failed to fetch ETH price. Using fallback.');
        setEthPriceUsd(3000); // Fallback price
        setLoadingPrice(false);
      }
    };
    
    fetchEthPrice();
    const interval = setInterval(fetchEthPrice, 60000); // Update every minute
    
    return () => clearInterval(interval);
  }, []);

  // Calculate round-up amount to nearest dollar
  const calculateRoundUp = (value: string): { roundUpEth: string; amountUsd: string; roundUpUsd: string; totalUsd: string } => {
    if (!value || parseFloat(value) <= 0 || ethPriceUsd === 0) {
      return { roundUpEth: '0', amountUsd: '0', roundUpUsd: '0', totalUsd: '0' };
    }
    
    const ethAmount = parseFloat(value);
    const amountInUsd = ethAmount * ethPriceUsd;
    const roundedUsd = Math.ceil(amountInUsd); // Round up to nearest dollar
    const roundUpUsd = roundedUsd - amountInUsd;
    const roundUpEth = roundUpUsd / ethPriceUsd;
    
    return {
      roundUpEth: roundUpEth.toFixed(6),
      amountUsd: amountInUsd.toFixed(2),
      roundUpUsd: roundUpUsd.toFixed(2),
      totalUsd: roundedUsd.toFixed(2)
    };
  };

  const { roundUpEth, amountUsd, roundUpUsd, totalUsd } = calculateRoundUp(amount);
  const totalAmount = amount && parseFloat(amount) > 0 
    ? (parseFloat(amount) + parseFloat(roundUpEth)).toFixed(6)
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
      await roundUp(recipient as `0x${string}`, totalAmount);
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
          {loadingPrice && (
            <p className="text-xs text-muted-foreground">Loading ETH price...</p>
          )}
          {!loadingPrice && ethPriceUsd > 0 && amount && parseFloat(amount) > 0 && (
            <p className="text-xs text-muted-foreground">
              ≈ ${amountUsd} USD (ETH @ ${ethPriceUsd.toLocaleString()})
            </p>
          )}
          {errors.amount && (
            <p className="text-xs text-destructive">{errors.amount}</p>
          )}
        </div>

        {/* Round-Up Info */}
        {amount && parseFloat(amount) > 0 && !loadingPrice && (
          <Alert>
            <TrendingUp className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Sending to recipient:</span>
                  <span className="font-semibold">{amount} ETH (${amountUsd})</span>
                </div>
                <div className="flex justify-between text-primary">
                  <span>Round-up to nearest $:</span>
                  <span className="font-semibold">+{roundUpEth} ETH (+${roundUpUsd})</span>
                </div>
                <div className="flex justify-between border-t pt-1 mt-1">
                  <span>Total from wallet:</span>
                  <span className="font-bold">{totalAmount} ETH (${totalUsd})</span>
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
                <li>Amount is rounded up to nearest whole dollar (in USD)</li>
                <li>Recipient receives exact amount you specify</li>
                <li>Round-up difference goes to your investment vault</li>
                <li>ETH price updated every minute</li>
                <li>Gas fees apply to the transaction</li>
              </ul>
            </div>
          </div>
        </div>

        <Button
          className="w-full"
          onClick={handleSend}
          disabled={isPending || loadingPrice || !recipient || !amount || parseFloat(amount) <= 0}
        >
          {isPending ? 'Sending...' : loadingPrice ? 'Loading...' : 'Send with Round-Up'}
        </Button>
      </div>
    </Card>
  );
};
