import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAccount } from 'wagmi';
import { Loader2, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { parseEther } from 'viem';

export function MetaMaskRoundUpTest() {
  const { address, isConnected } = useAccount();
  const [recipient, setRecipient] = useState('0x742d35Cc6634C0532925a3b844Bc454e4438f44e'); // Тестовый адрес
  const [amount, setAmount] = useState('0.001'); // Сумма в ETH
  const [isLoading, setIsLoading] = useState(false);

  const handleSendTransaction = async () => {
    if (!window.ethereum || !address) {
      toast.error('MetaMask not found');
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Enter valid amount');
      return;
    }

    try {
      setIsLoading(true);
      
      toast.info('Opening MetaMask', {
        description: 'Amount will be automatically rounded up before signing',
      });

      // Конвертируем сумму в wei
      const valueInWei = parseEther(amount);

      // Отправляем транзакцию с указанной суммой
      // roundUpTransport перехватит и округлит перед подписью
      const txHash = await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [
          {
            from: address,
            to: recipient,
            value: `0x${valueInWei.toString(16)}`,
          },
        ],
      });

      toast.success('Transaction sent!', {
        description: `Hash: ${txHash}`,
      });
    } catch (error: any) {
      console.error('Transaction error:', error);
      if (error.code === 4001) {
        toast.error('Transaction rejected');
      } else {
        toast.error(error.message || 'Transaction failed');
      }
    } finally {
      setIsLoading(false);
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
              Send ETH through MetaMask and see automatic rounding
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Info Banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
          <p className="text-sm font-semibold text-blue-900">💡 How to test:</p>
          <ol className="text-xs text-blue-800 space-y-1 list-decimal list-inside">
            <li>Enter amount in ETH below (e.g., 0.001 ETH)</li>
            <li>Click "Send Transaction" button</li>
            <li>Check the USD value in MetaMask popup - it will be rounded up!</li>
            <li>You'll see a notification with the round-up amount</li>
            <li>Confirm or reject the transaction in MetaMask</li>
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
            Example: 0.001 ETH ≈ $3.40 → will be rounded to $4.00
          </p>
        </div>

        {/* Recipient Address */}
        <div className="space-y-2">
          <Label htmlFor="recipient">Recipient Address (for testing)</Label>
          <Input
            id="recipient"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="0x..."
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            You can use any test address or keep the default
          </p>
        </div>

        {/* Action Button */}
        <Button
          onClick={handleSendTransaction}
          disabled={!isConnected || isLoading || !amount}
          className="w-full"
          size="lg"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Waiting for MetaMask...
            </>
          ) : (
            <>
              <Zap className="mr-2 h-4 w-4" />
              Send Transaction with Round-Up
            </>
          )}
        </Button>

        {!isConnected && (
          <p className="text-xs text-center text-muted-foreground">
            Connect your wallet first
          </p>
        )}

        {/* Additional Info */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <p className="text-xs text-yellow-800">
            <strong>Note:</strong> The amount you enter will be automatically rounded to the nearest whole dollar before you sign.
            For example, if you send ETH worth $2.50, MetaMask will show $3.00 in the confirmation popup.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
