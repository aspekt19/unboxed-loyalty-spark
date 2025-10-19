import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { usePublicClient, useAccount } from 'wagmi';
import { History, Loader2, AlertCircle, Filter } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { formatUnits } from 'viem';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

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
  const { session } = useAuth();
  const publicClient = usePublicClient();
  const [history, setHistory] = useState<IssuedToken[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedProgramFilter, setSelectedProgramFilter] = useState<string>('all');
  const [programs, setPrograms] = useState<any[]>([]);

  useEffect(() => {
    if (!address || !session) {
      setHistory([]);
      setPrograms([]);
      return;
    }

    loadIssuedTokens();

    // Обновляем историю когда выдаются новые токены
    const handleUpdate = () => {
      loadIssuedTokens();
    };

    window.addEventListener('loyaltyProgramsUpdated', handleUpdate);
    return () => window.removeEventListener('loyaltyProgramsUpdated', handleUpdate);
  }, [address, session, publicClient]);

  const loadIssuedTokens = async () => {
    if (!publicClient || !address || !session) {
      console.log('IssuedTokensHistory: No publicClient, address or session');
      return;
    }

    console.log('IssuedTokensHistory: Loading issued tokens...');
    setIsLoading(true);
    try {
      // Загружаем программы мерчанта из БД
      const { data: programsData, error } = await supabase
        .from('loyalty_programs')
        .select('*')
        .eq('merchant_address', address.toLowerCase())
        .in('status', ['active', 'expiring_soon'])
        .order('created_at', { ascending: false });

      if (error) {
        console.error('IssuedTokensHistory: Error loading programs:', error);
        setHistory([]);
        setPrograms([]);
        setIsLoading(false);
        return;
      }

      if (!programsData || programsData.length === 0) {
        console.log('IssuedTokensHistory: No programs found for merchant');
        setHistory([]);
        setPrograms([]);
        setIsLoading(false);
        return;
      }

      const activePrograms = programsData.map(p => ({
        name: p.name,
        symbol: p.symbol,
        tokenAddress: p.token_address,
      }));
      
      console.log('IssuedTokensHistory: Active programs:', activePrograms);
      setPrograms(activePrograms);

      const allIssuedTokens: IssuedToken[] = [];

      // Получаем текущий блок
      const currentBlock = await publicClient.getBlockNumber();
      const BLOCK_RANGE = 10000; // Уменьшаем диапазон до 10000 блоков

      // Для каждой программы получаем Transfer events (минтинг)
      for (const program of activePrograms) {
        try {
          console.log(`IssuedTokensHistory: Fetching logs for ${program.name} (${program.tokenAddress})`);
          
          const zeroAddress = '0x0000000000000000000000000000000000000000';

          // Запрашиваем блоки порциями
          let fromBlock = currentBlock - BigInt(BLOCK_RANGE);
          if (fromBlock < 0n) fromBlock = 0n;

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
            fromBlock,
            toBlock: currentBlock,
          });

          console.log(`IssuedTokensHistory: Found ${logs.length} transfer events for ${program.name}`);

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

  // Фильтруем историю по выбранной программе
  const filteredHistory = selectedProgramFilter === 'all' 
    ? history 
    : history.filter(item => item.tokenAddress === selectedProgramFilter);

  return (
    <Card className="border-2 h-full flex flex-col">
      <CardHeader className="flex-shrink-0">
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5 text-primary" />
          Issued Tokens History
        </CardTitle>
        <CardDescription>Track all loyalty tokens you've issued to customers</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden flex flex-col">
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
          <div className="flex flex-col h-full gap-4">
            <div className="space-y-3 flex-shrink-0">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="program-filter" className="text-sm font-medium">
                  Filter by Program
                </Label>
              </div>
              <Select value={selectedProgramFilter} onValueChange={setSelectedProgramFilter}>
                <SelectTrigger id="program-filter">
                  <SelectValue placeholder="All Programs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Programs</SelectItem>
                  {programs.map((program) => (
                    <SelectItem key={program.tokenAddress} value={program.tokenAddress}>
                      {program.name} ({program.symbol})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between flex-shrink-0">
              <p className="text-sm text-muted-foreground">
                Showing: <span className="font-semibold">{filteredHistory.length}</span> of {history.length} transactions
              </p>
            </div>
            
            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-3 pb-4">
                 {filteredHistory.map((item, index) => (
                  <div
                    key={`${item.transactionHash}-${index}`}
                    className="flex flex-col gap-3 p-4 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <div className="space-y-1">
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
                      className="text-xs text-primary hover:underline self-start"
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
