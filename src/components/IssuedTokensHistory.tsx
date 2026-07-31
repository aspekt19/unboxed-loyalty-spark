import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAccount } from 'wagmi';
import { History, Loader2, AlertCircle, Filter, Search } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { readCache, writeCache, scopedKey, type CacheOptions } from '@/lib/localCache';


interface IssuedToken {
  recipient: string;
  amount: string;
  tokenName: string;
  tokenSymbol: string;
  tokenAddress: string;
  timestamp: number;
  transactionHash: string | null;
}

interface ProgramOption {
  name: string;
  symbol: string;
  tokenAddress: string;
}

const HISTORY_CACHE = 'mint-history:merchant';
const PROGRAMS_CACHE = 'mint-history-programs:merchant';
const CACHE_OPTS: CacheOptions = { version: 1, ttlMs: 5 * 60 * 1000 };

export function IssuedTokensHistory() {
  const { address } = useAccount();
  const [history, setHistory] = useState<IssuedToken[]>(() =>
    readCache<IssuedToken[]>(scopedKey(HISTORY_CACHE, address), CACHE_OPTS) ?? []
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedProgramFilter, setSelectedProgramFilter] = useState<string>('all');
  const [customerSearch, setCustomerSearch] = useState<string>('');
  const [programs, setPrograms] = useState<ProgramOption[]>(() =>
    readCache<ProgramOption[]>(scopedKey(PROGRAMS_CACHE, address), CACHE_OPTS) ?? []
  );

  const hasLoadedRef = useRef(false);
  const loadingAddressRef = useRef<string | null>(null);

  useEffect(() => {
    if (!address) {
      setHistory([]);
      setPrograms([]);
      setIsLoading(false);
      hasLoadedRef.current = false;
      loadingAddressRef.current = null;
      return;
    }

    // Instant paint from the last snapshot for this wallet
    setHistory(readCache<IssuedToken[]>(scopedKey(HISTORY_CACHE, address), CACHE_OPTS) ?? []);
    setPrograms(readCache<ProgramOption[]>(scopedKey(PROGRAMS_CACHE, address), CACHE_OPTS) ?? []);

    if (!hasLoadedRef.current || loadingAddressRef.current !== address.toLowerCase()) {
      loadingAddressRef.current = address.toLowerCase();
      void loadHistory();
      hasLoadedRef.current = true;
    }

    const handleUpdate = () => void loadHistory();
    window.addEventListener('tokensIssued', handleUpdate);
    window.addEventListener('loyaltyProgramsUpdated', handleUpdate);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void loadHistory();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      window.removeEventListener('tokensIssued', handleUpdate);
      window.removeEventListener('loyaltyProgramsUpdated', handleUpdate);
      document.removeEventListener('visibilitychange', onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  const loadHistory = async () => {
    if (!address) return;

    const normalizedAddress = address.toLowerCase();
    const hasCached = !!readCache<IssuedToken[]>(scopedKey(HISTORY_CACHE, address), CACHE_OPTS);
    // Only block the UI when there is nothing cached to show
    setIsLoading(!hasCached);
    setError(null);

    try {
      // Load programs for filter dropdown
      const { data: programsData } = await supabase
        .from('loyalty_programs')
        .select('name, symbol, token_address')
        .eq('merchant_address', normalizedAddress)
        .order('created_at', { ascending: false });

      if (programsData) {
        const options = programsData
          .filter((p) => p.token_address)
          .map((p) => ({ name: p.name, symbol: p.symbol, tokenAddress: p.token_address }));
        setPrograms(options);
        writeCache(scopedKey(PROGRAMS_CACHE, address), options, CACHE_OPTS);
      }

      // Load mint history from DB
      const { data: mintData, error: mintError } = await supabase
        .from('token_mint_history')
        .select('*')
        .eq('merchant_address', normalizedAddress)
        .order('created_at', { ascending: false })
        .limit(200);

      if (mintError) {
        console.error('[IssuedTokensHistory] DB error:', mintError);
        setError('Failed to load history.');
        return;
      }

      const items: IssuedToken[] = (mintData || []).map((row: any) => ({
        recipient: row.recipient_address,
        amount: String(row.amount),
        tokenName: row.token_name,
        tokenSymbol: row.token_symbol,
        tokenAddress: row.token_address,
        timestamp: new Date(row.created_at).getTime(),
        transactionHash: row.transaction_hash,
      }));

      setHistory(items);
      writeCache(scopedKey(HISTORY_CACHE, address), items, CACHE_OPTS);

    } catch (err: any) {
      console.error('[IssuedTokensHistory] Error:', err);
      setError('Failed to load history.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!address) return null;

  const filteredHistory = history.filter((item) => {
    const programMatch = selectedProgramFilter === 'all' || item.tokenAddress === selectedProgramFilter;
    const customerMatch =
      !customerSearch || item.recipient.toLowerCase().includes(customerSearch.toLowerCase().trim());
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
        {isLoading ? (
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
                onClick={() => loadHistory()}
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
                Showing: <span className="font-semibold">{filteredHistory.length}</span> of {history.length}{' '}
                transactions
              </p>
            </div>

            <ScrollArea className="h-[300px] pr-4">
              <div className="space-y-3 pb-4">
                {filteredHistory.map((item, index) => (
                  <div
                    key={`${item.transactionHash || index}-${index}`}
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

                    {item.transactionHash && (
                      <a
                        href={`https://basescan.org/tx/${item.transactionHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline self-start"
                      >
                        View on BaseScan ↗
                      </a>
                    )}
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
