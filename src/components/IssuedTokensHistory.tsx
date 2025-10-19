import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { usePublicClient, useAccount } from 'wagmi';
import { History, Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { formatUnits } from 'viem';

interface IssuedToken {
  recipient: string;
  amount: string;
  tokenName: string;
  tokenSymbol: string;
  tokenAddress: string;
  timestamp: number;
  transactionHash: string;
}

export function IssuedTokensHistory() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const [history, setHistory] = useState<IssuedToken[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!address) {
      setHistory([]);
      return;
    }

    loadIssuedTokens();

    // Обновляем историю когда выдаются новые токены
    const handleUpdate = () => {
      loadIssuedTokens();
    };

    window.addEventListener('loyaltyProgramsUpdated', handleUpdate);
    return () => window.removeEventListener('loyaltyProgramsUpdated', handleUpdate);
  }, [address, publicClient]);

  const loadIssuedTokens = async () => {
    if (!publicClient || !address) return;

    setIsLoading(true);
    try {
      // Загружаем программы мерчанта из localStorage
      const loyaltyPrograms = localStorage.getItem('loyaltyPrograms');
      if (!loyaltyPrograms) {
        setHistory([]);
        setIsLoading(false);
        return;
      }

      const programs = JSON.parse(loyaltyPrograms);
      const activePrograms = programs.filter((p: any) => p.tokenAddress);

      const allIssuedTokens: IssuedToken[] = [];

      // Для каждой программы получаем Transfer events (минтинг)
      for (const program of activePrograms) {
        try {
          // Transfer event signature
          const transferEventSignature = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
          const zeroAddress = '0x0000000000000000000000000000000000000000';

          // Получаем Transfer события где from = 0x0 (минтинг)
          const logs = await publicClient.getLogs({
            address: program.tokenAddress as `0x${string}`,
            event: {
              type: 'event',
              name: 'Transfer',
              inputs: [
                { name: 'from', type: 'address', indexed: true },
                { name: 'to', type: 'address', indexed: true },
                { name: 'value', type: 'uint256', indexed: false },
              ],
            },
            args: {
              from: zeroAddress as `0x${string}`,
            },
            fromBlock: 'earliest',
            toBlock: 'latest',
          });

          // Обрабатываем события
          for (const log of logs) {
            if (!log.args.to || !log.args.value) continue;

            // Получаем блок для timestamp
            const block = await publicClient.getBlock({ blockHash: log.blockHash });

            allIssuedTokens.push({
              recipient: log.args.to as string,
              amount: formatUnits(log.args.value as bigint, 18),
              tokenName: program.name,
              tokenSymbol: program.symbol,
              tokenAddress: program.tokenAddress,
              timestamp: Number(block.timestamp) * 1000,
              transactionHash: log.transactionHash,
            });
          }
        } catch (error) {
          console.error(`Error loading history for ${program.name}:`, error);
        }
      }

      // Сортируем по времени (новые сверху)
      allIssuedTokens.sort((a, b) => b.timestamp - a.timestamp);
      setHistory(allIssuedTokens);
    } catch (error) {
      console.error('Error loading issued tokens history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!address) {
    return null;
  }

  return (
    <Card className="border-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5 text-primary" />
          Issued Tokens History
        </CardTitle>
        <CardDescription>Track all loyalty tokens you've issued to customers</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="ml-2 text-sm text-muted-foreground">Loading history...</span>
          </div>
        ) : history.length === 0 ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No tokens issued yet. Start issuing loyalty tokens to see history here!
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Total transactions: <span className="font-semibold">{history.length}</span>
              </p>
            </div>
            
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-3">
                {history.map((item, index) => (
                  <div
                    key={`${item.transactionHash}-${index}`}
                    className="flex items-start justify-between p-4 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="font-mono text-xs">
                          {item.tokenSymbol}
                        </Badge>
                        <span className="font-semibold text-primary">
                          +{parseFloat(item.amount).toFixed(2)} tokens
                        </span>
                      </div>
                      
                      <div className="text-sm">
                        <span className="text-muted-foreground">To: </span>
                        <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">
                          {item.recipient.slice(0, 6)}...{item.recipient.slice(-4)}
                        </code>
                      </div>
                      
                      <div className="text-xs text-muted-foreground">
                        {new Date(item.timestamp).toLocaleString()}
                      </div>
                    </div>

                    <a
                      href={`https://basescan.org/tx/${item.transactionHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline ml-4 flex-shrink-0"
                    >
                      View on BaseScan ↗
                    </a>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
