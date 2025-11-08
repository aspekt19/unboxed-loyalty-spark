import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useConfig } from 'wagmi';
import { Loader2, Zap, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { parseEther, formatEther } from 'viem';
import { getEthPrice, ethToUsd, roundUpUsd, usdToEth } from '@/lib/ethPrice';
import { ROUND_UP_CONFIG, ROUND_UP_VAULT_ABI } from '@/config/roundup';

export function MetaMaskRoundUpTest() {
  const { address, isConnected, chain } = useAccount();
  const config = useConfig();
  const [amount, setAmount] = useState('0.001');
  const [recipient, setRecipient] = useState('0x742d35Cc6634C0532925a3b844Bc454e4438f44e');
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const handleSendTransaction = async () => {
    if (!isConnected || !address) {
      toast.error('Please connect your wallet first');
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Enter valid amount');
      return;
    }

    try {
      // Get ETH price
      const ethPrice = await getEthPrice();
      
      // Convert entered amount to wei
      const originalValueWei = parseEther(amount);
      
      // Convert to USD for round-up calculation
      const usdAmount = ethToUsd(originalValueWei, ethPrice);
      
      // Round up to nearest dollar
      const roundedUsd = roundUpUsd(usdAmount);
      const roundUpUsdAmount = roundedUsd - usdAmount;
      
      // Convert ONLY THE ROUND-UP DIFFERENCE to ETH
      const roundUpEth = usdToEth(roundUpUsdAmount, ethPrice);
      const roundUpValueWei = parseEther(roundUpEth);
      
      // Calculate TOTAL value to send (original + roundUp)
      const totalValueWei = originalValueWei + roundUpValueWei;
      
      // Show round-up info
      toast.info(
        `Round-Up Applied: +$${roundUpUsdAmount.toFixed(2)} (+${roundUpEth} ETH)`,
        {
          description: `Original: $${usdAmount.toFixed(2)} → Rounded: $${roundedUsd.toFixed(2)}`,
          duration: 5000,
        }
      );
      
      console.log('Round-Up Transaction:', {
        originalETH: amount,
        roundUpETH: roundUpEth,
        totalETH: formatEther(totalValueWei),
        originalUSD: usdAmount.toFixed(2),
        roundedUSD: roundedUsd.toFixed(2),
        roundUpUSD: roundUpUsdAmount.toFixed(2),
        originalValueWei: originalValueWei.toString(),
        roundUpValueWei: roundUpValueWei.toString(),
        totalValueWei: totalValueWei.toString(),
        recipient,
      });
      
      // Validate recipient address
      if (!recipient || recipient.length !== 42 || !recipient.startsWith('0x')) {
        toast.error('Invalid recipient address');
        return;
      }
      
      // Call RoundUpVault contract with roundUpWithTransfer
      // This function automatically:
      // 1. Sends primary amount to recipient
      // 2. Keeps round-up in contract for investing
      const usdAmountScaled = BigInt(Math.floor(usdAmount * 100));
      
      writeContract({
        address: ROUND_UP_CONFIG.VAULT_ADDRESS as `0x${string}`,
        abi: ROUND_UP_VAULT_ABI,
        functionName: 'roundUpWithTransfer',
        args: [
          recipient as `0x${string}`,  // Recipient address
          originalValueWei,             // Primary amount in wei
          usdAmountScaled               // USD for statistics
        ],
        value: totalValueWei,           // Total: primary + roundUp
        account: address,
        chain: chain,
      });
      
    } catch (error: any) {
      console.error('Transaction error:', error);
      
      if (error.code === 4001) {
        toast.error('Transaction rejected', {
          description: 'You rejected the transaction in MetaMask',
        });
      } else {
        toast.error('Transaction failed', {
          description: error.message || 'An error occurred',
        });
      }
    }
  };

  return (
    <Card className="border-2 border-primary/20">
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Zap className="w-5 h-5 text-primary" />
          </div>
          <div>
            <CardTitle>MetaMask Round-Up Test</CardTitle>
            <CardDescription>
              Send ETH and see automatic USD round-up in action
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Info Banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
          <p className="text-sm font-semibold text-blue-900">💡 How it works (ONE transaction!):</p>
          <ol className="text-xs text-blue-800 space-y-1 list-decimal list-inside">
            <li>Enter an amount in ETH below (e.g., 0.001 ETH ≈ $3.41)</li>
            <li>We calculate the round-up to nearest dollar ($4.00)</li>
            <li>ONE transaction automatically splits the payment:</li>
            <li className="ml-6">• Original amount → Recipient</li>
            <li className="ml-6">• Round-up ($0.59) → RoundUpVault for investing</li>
          </ol>
        </div>

        {/* Amount Input */}
        <div className="space-y-2">
          <Label htmlFor="amount">Amount to Send (ETH)</Label>
          <Input
            id="amount"
            type="number"
            step="0.0001"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.001"
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Example: 0.001 ETH ≈ $3.41 → will be rounded to $4.00
          </p>
        </div>

        {/* Recipient Address */}
        <div className="space-y-2">
          <Label htmlFor="recipient">Recipient Address</Label>
          <Input
            id="recipient"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="0x..."
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Where to send the primary amount (test address provided)
          </p>
        </div>


        {/* Action Button */}
        <Button
          onClick={handleSendTransaction}
          disabled={!isConnected || isPending || isConfirming || !amount}
          className="w-full"
          size="lg"
        >
          {isPending || isConfirming ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {isPending ? 'Check MetaMask...' : 'Confirming...'}
            </>
          ) : isSuccess ? (
            <>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Transaction Confirmed!
            </>
          ) : (
            <>
              <Zap className="mr-2 h-4 w-4" />
              Send with Auto Round-Up
            </>
          )}
        </Button>
        
        {/* Transaction Status */}
        {hash && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm font-semibold text-green-900 mb-1">
              {isConfirming ? '⏳ Confirming transaction...' : '✅ Transaction confirmed!'}
            </p>
            <p className="text-xs text-green-700 break-all">
              Hash: {hash}
            </p>
          </div>
        )}

        {!isConnected && (
          <p className="text-xs text-center text-muted-foreground">
            Connect your wallet to test
          </p>
        )}

        {/* Additional Info */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <p className="text-xs text-green-800">
            <strong>⭐ New feature:</strong> One transaction automatically splits your payment! 
            The recipient gets the original amount, and the round-up goes to your investment vault.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
