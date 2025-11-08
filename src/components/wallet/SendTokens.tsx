import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAccount, useSendTransaction, useWaitForTransactionReceipt } from "wagmi";
import { parseEther, isAddress } from "viem";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Send } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function SendTokens() {
  const { address } = useAccount();
  const { toast } = useToast();
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [token, setToken] = useState("ETH");

  const { data: hash, sendTransaction, isPending } = useSendTransaction();
  
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const handleSend = async () => {
    if (!recipient || !amount) {
      toast({
        title: "Error",
        description: "Please fill all fields",
        variant: "destructive",
      });
      return;
    }

    if (!isAddress(recipient)) {
      toast({
        title: "Invalid Address",
        description: "Please enter a valid Ethereum address",
        variant: "destructive",
      });
      return;
    }

    try {
      sendTransaction({
        to: recipient as `0x${string}`,
        value: parseEther(amount),
      });
    } catch (error) {
      console.error("Send error:", error);
      toast({
        title: "Transaction Failed",
        description: error instanceof Error ? error.message : "Failed to send transaction",
        variant: "destructive",
      });
    }
  };

  if (isSuccess) {
    toast({
      title: "Transaction Successful",
      description: `Sent ${amount} ${token} to ${recipient.slice(0, 6)}...${recipient.slice(-4)}`,
    });
    setRecipient("");
    setAmount("");
  }

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
          <Label htmlFor="amount">Amount</Label>
          <div className="relative">
            <Input
              id="amount"
              type="number"
              step="0.0001"
              placeholder="0.0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="pr-16"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              {token}
            </span>
          </div>
        </div>

        {amount && (
          <div className="p-4 rounded-lg bg-muted space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Amount</span>
              <span className="font-semibold">{amount} {token}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Network Fee</span>
              <span className="font-semibold">~$0.50</span>
            </div>
            <div className="h-px bg-border my-2" />
            <div className="flex justify-between">
              <span className="font-semibold">Total</span>
              <span className="font-bold">{amount} {token}</span>
            </div>
          </div>
        )}

        <Button
          onClick={handleSend}
          disabled={isPending || isConfirming || !recipient || !amount}
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
              Send {token}
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
