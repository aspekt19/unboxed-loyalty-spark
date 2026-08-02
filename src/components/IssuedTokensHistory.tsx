import { useState, useEffect, useMemo } from 'react';
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
import { useQuery } from '@tanstack/react-query';
import { useMerchantPrograms } from '@/hooks/useMerchantPrograms';

interface IssuedToken {
  recipient: string;
  amount: string;
  tokenName: string;
  tokenSymbol: string;
  tokenAddress: string;
  timestamp: number;
  transactionHash: string | null;
}

export function IssuedTokensHistory() {
  const { address } = useAccount();
  const [selectedProgramFilter, setSelectedProgramFilter] = useState<string>('all');
  const [customerSearch, setCustomerSearch] = useState<string>('');
  const { data: programRows = [], isLoading: programsLoading } = useMerchantPrograms(address);

  const programs = useMemo(
    () =>
      programRows
        .filter((p) => p.token_address)
        .map((p) => ({
          name: p.name,
          symbol: p.symbol,
          tokenAddress: p.token_address as string,
        })),
    [programRows],
  );

  const mintQuery = useQuery({
    queryKey: ['merchant', 'mint-history', address?.toLowerCase() ?? null],
    enabled: Boolean(address),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<IssuedToken[]> => {
      const normalizedAddress = address!.toLowerCase();
      const { data: mintData, error: mintError } = await supabase
        .from('token_mint_history')
        .select('*')
        .eq('merchant_address', normalizedAddress)
        .order('created_at', { ascending: false })
        .limit(200);

      if (mintError) throw mintError;
      if (!mintData || mintData.length === 0) return [];

      return mintData.map((row) => ({
        recipient: row.recipient_address,
        amount: String(row.amount),
        tokenName: row.token_name,
        tokenSymbol: row.token_symbol,
        tokenAddress: row.token_address,
        timestamp: new Date(row.created_at).getTime(),
        transactionHash: row.transaction_hash,
      }));
    },
  });

  useEffect(() => {
    const handleUpdate = () => {
      void mintQuery.refetch();
    };
    window.addEventListener('tokensIssued', handleUpdate);
    window.addEventListener('loyaltyProgramsUpdated', handleUpdate);
    return () => {
      window.removeEventListener('tokensIssued', handleUpdate);
      window.removeEventListener('loyaltyProgramsUpdated', handleUpdate);
    };
  }, [mintQuery]);

  const history = mintQuery.data ?? [];
  const isLoading = Boolean(address) && (programsLoading || mintQuery.isLoading);
  const error = mintQuery.error ? 'Failed to load history.' : null;

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
                onClick={() => void mintQuery.refetch()}
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
