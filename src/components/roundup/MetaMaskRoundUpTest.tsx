import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAccount } from 'wagmi';
import { Loader2, Zap } from 'lucide-react';
import { toast } from 'sonner';

export function MetaMaskRoundUpTest() {
  const { address, isConnected } = useAccount();
  const [recipient, setRecipient] = useState('0x742d35Cc6634C0532925a3b844Bc454e4438f44e'); // Тестовый адрес
  const [isLoading, setIsLoading] = useState(false);

  const handleSendTransaction = async () => {
    if (!window.ethereum || !address) {
      toast.error('MetaMask not found');
      return;
    }

    try {
      setIsLoading(true);
      
      toast.info('Opening MetaMask', {
        description: 'Enter the amount you want to send. It will be automatically rounded up.',
      });

      // Открываем MetaMask с минимальными параметрами
      // Пользователь сам вводит сумму в MetaMask
      const txHash = await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [
          {
            from: address,
            to: recipient,
            // value НЕ указываем - пользователь введет в MetaMask
            // Наш roundUpTransport перехватит и округлит перед подписью
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
            <li>Click "Open MetaMask" button below</li>
            <li>Enter amount in ETH in MetaMask popup (e.g., amount worth $2.50)</li>
            <li>Check the USD value shown in MetaMask</li>
            <li>Our system will automatically round it up before signature</li>
            <li>You'll see a notification with the round-up amount</li>
          </ol>
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
          disabled={!isConnected || isLoading}
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
              Open MetaMask Transaction
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
            <strong>Note:</strong> The amount will be automatically rounded to the nearest whole dollar.
            For example, if you enter ETH worth $2.50, MetaMask will show $3.00 for signature.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
