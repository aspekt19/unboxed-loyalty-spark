import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useReadContract, useAccount } from 'wagmi';
import { formatEther, parseUnits } from 'viem';
import { useRoundUp } from '@/hooks/useRoundUp';
import { ROUND_UP_CONFIG, ROUND_UP_VAULT_ABI } from '@/config/roundup';
import { ArrowRight, DollarSign } from 'lucide-react';
import { toast } from 'sonner';

export function RoundUpTestForm() {
  const { isConnected } = useAccount();
  const [purchaseAmount, setPurchaseAmount] = useState('');
  const { executeRoundUp, isProcessing, isSuccess } = useRoundUp();

  // Получаем текущую цену ETH из контракта
  const { data: ethPriceData } = useReadContract({
    address: ROUND_UP_CONFIG.VAULT_ADDRESS,
    abi: ROUND_UP_VAULT_ABI,
    functionName: 'getEthPrice',
    query: {
      enabled: isConnected && ROUND_UP_CONFIG.VAULT_ADDRESS !== '0x0000000000000000000000000000000000000000',
    },
  });

  useEffect(() => {
    if (isSuccess) {
      setPurchaseAmount('');
      toast.success('Round-Up successfully completed!');
    }
  }, [isSuccess]);

  // Рассчитываем Round-Up
  const calculateRoundUp = () => {
    if (!purchaseAmount || isNaN(parseFloat(purchaseAmount))) {
      return {
        roundedAmount: 0,
        roundUpUSD: 0,
        roundUpETH: '0',
        primaryTxValueUSD: BigInt(0),
      };
    }

    const purchase = parseFloat(purchaseAmount);
    const rounded = Math.ceil(purchase);
    const roundUpUSD = rounded - purchase;

    let roundUpETH = '0';
    if (ethPriceData) {
      // ethPriceData comes with 8 decimals from Chainlink
      const ethPrice = Number(ethPriceData) / 1e8; // Convert to normal USD
      roundUpETH = (roundUpUSD / ethPrice).toFixed(6);
    }

    // Convert purchase amount to USD with 8 decimals for contract
    const primaryTxValueUSD = parseUnits(purchase.toFixed(2), 8);

    return {
      roundedAmount: rounded,
      roundUpUSD: roundUpUSD,
      roundUpETH,
      primaryTxValueUSD,
    };
  };

  const { roundedAmount, roundUpUSD, roundUpETH, primaryTxValueUSD } = calculateRoundUp();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    console.log('Form submitted', { purchaseAmount, ethPriceData, roundUpETH });

    if (!purchaseAmount || parseFloat(purchaseAmount) <= 0) {
      toast.error('Please enter a valid purchase amount');
      return;
    }

    if (!ethPriceData) {
      toast.error('Unable to fetch ETH price');
      console.error('ETH price not available');
      return;
    }

    if (parseFloat(roundUpETH) < 0.0001) {
      toast.error('Round-up amount too small');
      console.error('Round-up too small:', roundUpETH);
      return;
    }

    console.log('Executing round-up with:', { primaryTxValueUSD, roundUpETH });
    const result = await executeRoundUp(primaryTxValueUSD, roundUpETH);
    console.log('Round-up result:', result);
  };

  const isFormValid = 
    purchaseAmount && 
    parseFloat(purchaseAmount) > 0 && 
    ethPriceData && 
    parseFloat(roundUpETH) >= 0.0001;

  console.log('Form validation state:', {
    purchaseAmount,
    purchaseAmountValid: purchaseAmount && parseFloat(purchaseAmount) > 0,
    ethPriceData: !!ethPriceData,
    roundUpETH,
    roundUpETHValid: parseFloat(roundUpETH) >= 0.0001,
    isFormValid,
    isConnected,
    isProcessing,
  });

  return (
    <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <DollarSign className="w-5 h-5 text-primary" />
          </div>
          <div>
            <CardTitle>Test Round-Up</CardTitle>
            <CardDescription>Simulate a purchase and see how Round-Up works</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Purchase Amount Input */}
          <div className="space-y-2">
            <Label htmlFor="purchaseAmount">Purchase Amount (USD)</Label>
            <Input
              id="purchaseAmount"
              type="number"
              step="0.01"
              min="0"
              placeholder="34.41"
              value={purchaseAmount}
              onChange={(e) => setPurchaseAmount(e.target.value)}
              disabled={!isConnected || isProcessing}
              className="text-lg"
            />
            <p className="text-xs text-muted-foreground">
              Enter the amount of your simulated purchase
            </p>
          </div>

          {/* Calculation Display */}
          {purchaseAmount && parseFloat(purchaseAmount) > 0 && (
            <div className="bg-secondary/20 rounded-lg p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Purchase amount:</span>
                <span className="font-mono font-semibold">${parseFloat(purchaseAmount).toFixed(2)}</span>
              </div>
              
              <div className="flex items-center justify-center py-2">
                <ArrowRight className="w-5 h-5 text-muted-foreground" />
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Rounded to:</span>
                <span className="font-mono font-semibold text-lg">${roundedAmount}.00</span>
              </div>

              <div className="border-t border-border pt-3 mt-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-primary">Round-Up amount:</span>
                  <span className="font-mono font-bold text-primary">${roundUpUSD.toFixed(2)}</span>
                </div>
                {ethPriceData && (
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-xs text-muted-foreground">In ETH:</span>
                    <span className="font-mono text-sm">{roundUpETH} ETH</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={!isConnected || isProcessing || !isFormValid}
            onClick={() => console.log('Button clicked!', { isConnected, isProcessing, isFormValid })}
          >
            {isProcessing ? 'Processing...' : 'Execute Round-Up'}
          </Button>

          {!isConnected && (
            <p className="text-xs text-center text-muted-foreground">
              Connect your wallet to test Round-Up
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
