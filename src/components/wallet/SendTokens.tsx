import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAccount, useSendTransaction, useWaitForTransactionReceipt } from "wagmi";
import { parseEther, isAddress } from "viem";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Send, TrendingUp } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRoundUp } from "@/hooks/useRoundUp";
import { toast } from "sonner";

export default function SendTokens() {
  const { address } = useAccount();
  const [recipient, setRecipient] = useState("");
  const [amountUSD, setAmountUSD] = useState("");
  const [token, setToken] = useState("ETH");
  const [ethPrice, setEthPrice] = useState(3400); // Default ETH price
  
  const { data: hash, sendTransaction, isPending } = useSendTransaction();
  const { executeRoundUp } = useRoundUp();
  
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  // Fetch ETH price on mount
  useEffect(() => {
    const fetchEthPrice = async () => {
      try {
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
        const data = await response.json();
        if (data.ethereum?.usd) {
          setEthPrice(data.ethereum.usd);
        }
      } catch (error) {
        console.error('Failed to fetch ETH price:', error);
      }
    };
    fetchEthPrice();
  }, []);

  // Calculate rounded amount and ETH equivalent
  const calculateRoundedAmount = (inputUSD: string) => {
    if (!inputUSD || parseFloat(inputUSD) <= 0) return { roundedUSD: 0, ethAmount: "0", roundUpUSD: 0 };
    
    const originalUSD = parseFloat(inputUSD);
    const roundedUSD = Math.ceil(originalUSD); // Round up to nearest dollar
    const roundUpUSD = roundedUSD - originalUSD;
    const ethAmount = (roundedUSD / ethPrice).toFixed(6);
    
    return { roundedUSD, ethAmount, roundUpUSD };
  };

  const { roundedUSD, ethAmount, roundUpUSD } = calculateRoundedAmount(amountUSD);

  const handleSend = async () => {
    if (!recipient || !amountUSD) {
      toast.error("Please fill all fields");
      return;
    }

    if (!isAddress(recipient)) {
      toast.error("Please enter a valid Ethereum address");
      return;
    }

    if (roundedUSD <= 0) {
      toast.error("Amount must be greater than 0");
      return;
    }

    try {
      // Send the rounded ETH amount
      sendTransaction({
        to: recipient as `0x${string}`,
        value: parseEther(ethAmount),
      });
      
      // Show round-up info
      if (roundUpUSD > 0) {
        toast.success(`Round-Up: $${roundUpUSD.toFixed(2)} will be saved for investing`, {
          description: `Sending $${roundedUSD} (${ethAmount} ETH)`,
          icon: <TrendingUp className="w-4 h-4" />,
        });
      }
    } catch (error) {
      console.error("Send error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to send transaction");
    }
  };

  // Handle successful transaction
  useEffect(() => {
    if (isSuccess && hash && roundUpUSD > 0) {
      // Execute round-up transaction
      const roundUpETH = (roundUpUSD / ethPrice).toFixed(6);
      executeRoundUp(BigInt(Math.floor(roundedUSD * 100)), roundUpETH);
      
      toast.success("Transaction Successful!", {
        description: `Sent $${roundedUSD} to ${recipient.slice(0, 6)}...${recipient.slice(-4)}`,
      });
      
      // Reset form
      setRecipient("");
      setAmountUSD("");
    }
  }, [isSuccess, hash, roundUpUSD]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="w-5 h-5" />
          Send Tokens
        </CardTitle>
        <CardDescription>
          Transfer tokens to another wallet address
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="token">Token</Label>
          <Select value={token} onValueChange={setToken}>
            <SelectTrigger id="token">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ETH">ETH - Ethereum</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="recipient">Recipient Address</Label>
          <Input
            id="recipient"
            placeholder="0x..."
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            className="font-mono"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="amount">Amount (USD)</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              $
            </span>
            <Input
              id="amount"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={amountUSD}
              onChange={(e) => setAmountUSD(e.target.value)}
              className="pl-8 pr-16"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              USD
            </span>
          </div>
          {amountUSD && roundUpUSD > 0 && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              Auto-rounded from ${parseFloat(amountUSD).toFixed(2)} (+${roundUpUSD.toFixed(2)})
            </p>
          )}
        </div>

        {amountUSD && roundedUSD > 0 && (
          <div className="p-4 rounded-lg bg-muted space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">You entered</span>
              <span className="font-semibold">${parseFloat(amountUSD).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Rounded to</span>
              <span className="font-semibold text-primary">${roundedUSD.toFixed(2)}</span>
            </div>
            {roundUpUSD > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  Round-Up saved
                </span>
                <span className="font-semibold text-green-600">${roundUpUSD.toFixed(2)}</span>
              </div>
            )}
            <div className="h-px bg-border my-2" />
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">ETH Amount</span>
              <span className="font-semibold">{ethAmount} {token}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Network Fee</span>
              <span className="font-semibold">~$0.50</span>
            </div>
            <div className="h-px bg-border my-2" />
            <div className="flex justify-between">
              <span className="font-semibold">Total Sending</span>
              <span className="font-bold">${roundedUSD.toFixed(2)}</span>
            </div>
          </div>
        )}

        <Button
          onClick={handleSend}
          disabled={isPending || isConfirming || !recipient || !amountUSD || roundedUSD <= 0}
          className="w-full"
          size="lg"
        >
          {isPending || isConfirming ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {isConfirming ? "Confirming..." : "Sending..."}
            </>
          ) : (
            <>
              <Send className="mr-2 h-4 w-4" />
              Send ${roundedUSD.toFixed(2)} ({ethAmount} ETH)
            </>
          )}
        </Button>

        {hash && (
          <div className="text-sm text-center text-muted-foreground">
            Transaction: {hash.slice(0, 10)}...{hash.slice(-8)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
