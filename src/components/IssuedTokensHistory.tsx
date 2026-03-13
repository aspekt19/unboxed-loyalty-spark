import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAccount } from 'wagmi';
import { History, Loader2, AlertCircle, Filter, Search } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { createPublicClient, formatUnits, http, parseAbiItem } from 'viem';
import { base } from 'viem/chains';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
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

interface ProgramOption {
  name: string;
  symbol: string;
  tokenAddress: string;
}

const historyRpcClient = createPublicClient({
  chain: base,
  transport: http('https://base-rpc.publicnode.com', {
    batch: false,
    retryCount: 0,
    timeout: 6_000,
  }),
});

const transferEvent = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)');

export function IssuedTokensHistory() {
  const { address } = useAccount();
  const { session, isLoading: authLoading } = useAuth();
  const [history, setHistory] = useState<IssuedToken[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedProgramFilter, setSelectedProgramFilter] = useState<string>('all');
  const [customerSearch, setCustomerSearch] = useState<string>('');
  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const hasLoadedRef = useRef(false);
  const loadingAddressRef = useRef<string | null>(null);
  const isFetchingRef = useRef(false);
  const pendingRefreshRef = useRef(false);

  useEffect(() => {
    if (authLoading) return;

    if (!address) {
      setHistory([]);
      setPrograms([]);
      setIsLoading(false);
      hasLoadedRef.current = false;
      loadingAddressRef.current = null;
      isFetchingRef.current = false;
      pendingRefreshRef.current = false;
      return;
    }

    // Don't block on missing session — the RPC queries don't need auth,
    // only the Supabase programs query does, and it will gracefully
    // return empty if the session is still being established.

    if (!hasLoadedRef.current || loadingAddressRef.current !== address.toLowerCase()) {
      loadingAddressRef.current = address.toLowerCase();
      void loadIssuedTokens(false);
      hasLoadedRef.current = true;
    }

    const handleUpdate = () => {
      void loadIssuedTokens(true);
    };

    window.addEventListener('loyaltyProgramsUpdated', handleUpdate);
    window.addEventListener('tokensIssued', handleUpdate);

    return () => {
      window.removeEventListener('loyaltyProgramsUpdated', handleUpdate);
      window.removeEventListener('tokensIssued', handleUpdate);
    };
  }, [address, session, authLoading]);

  const loadIssuedTokens = async (silent = false) => {
    if (!address) return;

    if (!session) {
      setIsLoading(false);
      setError('Authentication is required to load history.');
      return;
    }

    if (isFetchingRef.current) {
      pendingRefreshRef.current = true;
      return;
    }

    isFetchingRef.current = true;
    if (!silent || history.length === 0) {
      setIsLoading(true);
    }
    setError(null);

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Loading timeout - please try again')), 15_000);
    });

    try {
      await Promise.race([
        (async () => {
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

          const normalizedAddress = address.toLowerCase();

          const { data: programsData, error: programsError } = await supabase
            .from('loyalty_programs')
            .select('name, symbol, token_address')
            .eq('merchant_address', normalizedAddress)
            .or(`status.in.(active,expiring_soon,paused),and(status.eq.expired,expiration_date.gte.${thirtyDaysAgo.toISOString()})`)
            .order('created_at', { ascending: false });

          if (programsError) {
            console.error('[IssuedTokensHistory] Error loading programs:', programsError);
            throw programsError;
          }

          if (!programsData || programsData.length === 0) {
            setHistory([]);
            setPrograms([]);
            return;
          }

          const activePrograms: ProgramOption[] = programsData
            .filter((p) => p.token_address)
            .map((p) => ({
              name: p.name,
              symbol: p.symbol,
              tokenAddress: p.token_address,
            }));

          setPrograms(activePrograms);

          const allIssuedTokens: IssuedToken[] = [];
          const currentBlock = await historyRpcClient.getBlockNumber();
          const chunkSize = 40_000n;
          const lookbackBlocks = 40_000n;
          const zeroAddress = '0x0000000000000000000000000000000000000000' as const;
          const fromBlock = currentBlock > lookbackBlocks ? currentBlock - lookbackBlocks : 0n;

          for (const program of activePrograms) {
            try {
              const programLogs: any[] = [];
              let currentChunkStart = fromBlock;

              while (currentChunkStart <= currentBlock) {
                const currentChunkEnd =
                  currentChunkStart + chunkSize > currentBlock ? currentBlock : currentChunkStart + chunkSize;

                try {
                  const logs = await historyRpcClient.getLogs({
                    address: program.tokenAddress as `0x${string}`,
                    event: transferEvent,
                    args: { from: zeroAddress },
                    fromBlock: currentChunkStart,
                    toBlock: currentChunkEnd,
                  });

                  if (logs.length > 0) {
                    programLogs.push(...logs);
                  }
                } catch (chunkError) {
                  console.error('[IssuedTokensHistory] Error querying chunk:', chunkError);
                }

                currentChunkStart = currentChunkEnd + 1n;
              }

              if (programLogs.length === 0) continue;

              const uniqueBlockHashes = Array.from(
                new Set(programLogs.map((log) => log.blockHash).filter(Boolean))
              ) as `0x${string}`[];

              const blockTimestamps = new Map<string, number>();
              await Promise.all(
                uniqueBlockHashes.map(async (blockHash) => {
                  try {
                    const block = await historyRpcClient.getBlock({ blockHash });
                    blockTimestamps.set(blockHash, Number(block.timestamp) * 1000);
                  } catch {
                    blockTimestamps.set(blockHash, Date.now());
                  }
                })
              );

              for (const log of programLogs) {
                if (!log.args.to || !log.args.value) continue;

                allIssuedTokens.push({
                  recipient: log.args.to as string,
                  amount: formatUnits(log.args.value as bigint, 18),
                  tokenName: program.name,
                  tokenSymbol: program.symbol,
                  tokenAddress: program.tokenAddress,
                  timestamp: blockTimestamps.get(log.blockHash as string) ?? Date.now(),
                  transactionHash: log.transactionHash,
                });
              }
            } catch (programError) {
              console.error(`[IssuedTokensHistory] Error loading history for ${program.name}:`, programError);
            }
          }

          allIssuedTokens.sort((a, b) => b.timestamp - a.timestamp);
          setHistory(allIssuedTokens);
        })(),
        timeoutPromise,
      ]);
    } catch (loadError: any) {
      console.error('[IssuedTokensHistory] Error:', loadError);
      setError(loadError?.message || 'Failed to load history. Please try again.');
    } finally {
      isFetchingRef.current = false;
      setIsLoading(false);

      if (pendingRefreshRef.current) {
        pendingRefreshRef.current = false;
        void loadIssuedTokens(true);
      }
    }
  };

  if (!address) {
    return null;
  }

  const filteredHistory = history.filter(item => {
    const programMatch = selectedProgramFilter === 'all' || item.tokenAddress === selectedProgramFilter;
    const customerMatch = !customerSearch || 
      item.recipient.toLowerCase().includes(customerSearch.toLowerCase().trim());
    return programMatch && customerMatch;
  });

  return (
    <Card className="border-2 h-full flex flex-col min-h-[200px]">
      <CardHeader className="flex-shrink-0">
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5 text-primary" />
          Issued Tokens History
        </CardTitle>
        <CardDescription>Track all loyalty tokens you've issued to customers</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden flex flex-col">
        {authLoading || isLoading ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="ml-2 text-sm text-muted-foreground">Loading history...</span>
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex flex-col gap-3">
              <span>{error}</span>
              <button
                onClick={() => loadIssuedTokens()}
                className="text-sm underline hover:no-underline self-start"
              >
                Try again
              </button>
            </AlertDescription>
          </Alert>
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

            <div className="space-y-3 flex-shrink-0">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="customer-search" className="text-sm font-medium">
                  Search by Customer Address
                </Label>
              </div>
              <Input
                id="customer-search"
                type="text"
                placeholder="Enter wallet address (0x...)"
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                className="font-mono text-sm"
              />
            </div>

            <div className="flex items-center justify-between flex-shrink-0">
              <p className="text-sm text-muted-foreground">
                Showing: <span className="font-semibold">{filteredHistory.length}</span> of {history.length} transactions
              </p>
            </div>
            
            <ScrollArea className="h-[300px] pr-4">
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
