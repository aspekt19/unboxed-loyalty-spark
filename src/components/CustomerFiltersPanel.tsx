import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTierSummaries, type TierSummary } from '@/hooks/useTierSummaries';
import { CompactTierInline } from '@/components/tiers/CompactTierInline';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAccount } from 'wagmi';
import { Gift, Loader2, AlertCircle, Store, Clock, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useMultiTokenBalance } from '@/hooks/useMultiTokenBalance';
import { useCheckProgramStatus } from '@/hooks/useCheckProgramStatus';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import useEmblaCarousel from 'embla-carousel-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useFarcasterHaptics } from '@/hooks/useFarcasterHaptics';
import { useActiveWallet } from '@/contexts/ActiveWalletContext';

interface LoyaltyProgram {
  id: string;
  token_address: string;
  name: string;
  symbol: string;
  status: string;
  expiration_date: string;
  merchant_address: string;
}

interface TokenInfo {
  address: string;
  name: string;
  symbol: string;
  status: string;
  expirationDate: string;
  merchantAddress: string;
}

interface CustomerFiltersPanelProps {
  filterByMerchant?: string | null;
}

export function CustomerFiltersPanel({ filterByMerchant }: CustomerFiltersPanelProps) {
  const { address } = useAccount();
  const { activeWallet } = useActiveWallet();
  const [programs, setPrograms] = useState<TokenInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const isMobile = useIsMobile();
  const { selectionChanged } = useFarcasterHaptics();

  const [emblaRef, emblaApi] = useEmblaCarousel({ 
    align: 'start',
    containScroll: 'trimSnaps',
    dragFree: false,
  });
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  
  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setCanScrollPrev(emblaApi.canScrollPrev());
    setCanScrollNext(emblaApi.canScrollNext());
    const newSlide = emblaApi.selectedScrollSnap();
    if (newSlide !== currentSlide) {
      selectionChanged();
    }
    setCurrentSlide(newSlide);
  }, [emblaApi, currentSlide, selectionChanged]);
  
  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on('select', onSelect);
    emblaApi.on('reInit', onSelect);
    return () => {
      emblaApi.off('select', onSelect);
      emblaApi.off('reInit', onSelect);
    };
  }, [emblaApi, onSelect]);

  const { balances, isLoading: balancesLoading, refetch } = useMultiTokenBalance(programs, activeWallet);

  const loadActivePrograms = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('loyalty_programs')
        .select('*')
        .in('status', ['active', 'expiring_soon', 'paused'])
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[CustomerFiltersPanel] Error loading programs:', error.message);
        return;
      }

      setPrograms(data.map((prog: LoyaltyProgram) => ({
        address: prog.token_address,
        name: prog.name,
        symbol: prog.symbol,
        status: prog.status,
        expirationDate: prog.expiration_date,
        merchantAddress: prog.merchant_address,
      })));
    } catch (error) {
      console.error('[CustomerFiltersPanel] Failed to load programs:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load active programs from Supabase
  useEffect(() => {
    if (!activeWallet) {
      setPrograms([]);
      return;
    }

    loadActivePrograms();

    const channel = supabase
      .channel('customer_loyalty_programs')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'loyalty_programs' },
        () => loadActivePrograms()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeWallet, loadActivePrograms]);

  // Listen for token balance updates
  useEffect(() => {
    const handleBalanceUpdate = () => refetch(true);
    window.addEventListener('tokenBalancesUpdated', handleBalanceUpdate);
    return () => window.removeEventListener('tokenBalancesUpdated', handleBalanceUpdate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-refresh balances every 5 seconds
  useEffect(() => {
    if (!activeWallet || programs.length === 0) return;

    const interval = setInterval(() => refetch(true), 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWallet, programs.length]);

  // Filter programs with non-zero balance, then by merchant and search
  const programsWithBalance = useMemo(() => {
    let result = programs.filter(program => {
      const balance = balances.find(b => b.address === program.address);
      return balance && parseFloat(balance.balance) > 0;
    });
    if (filterByMerchant) {
      result = result.filter(p => p.merchantAddress.toLowerCase() === filterByMerchant.toLowerCase());
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.symbol.toLowerCase().includes(q)
      );
    }
    return result;
  }, [programs, balances, filterByMerchant, searchQuery]);

  const tierEntries = useMemo(
    () =>
      programsWithBalance.map((p) => {
        const balance = balances.find((b) => b.address === p.address);
        return {
          tokenAddress: p.address,
          balance: balance?.balance || '0',
          symbol: p.symbol,
        };
      }),
    [programsWithBalance, balances],
  );
  const tierSummaries = useTierSummaries(tierEntries);

  if (!address) return null;

  return (
    <Card className="border-2 h-full flex flex-col">
      <CardHeader className="flex-shrink-0">
        <CardTitle className="flex items-center gap-2">
          <Gift className="h-5 w-5 text-primary" />
          Loyalty Programs
        </CardTitle>
        <CardDescription>
          {filterByMerchant 
            ? 'Showing programs for selected merchant' 
            : 'Each merchant issues their own token. Your balance never expires unless you use it.'
          }
        </CardDescription>
        {programsWithBalance.length > 1 && (
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search programs..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        )}
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden flex flex-col">
        {isLoading || balancesLoading ? (
          <div className="space-y-3 py-4">
            <div className="space-y-2">
              <div className="h-20 rounded-lg bg-muted animate-pulse" />
              <div className="h-20 rounded-lg bg-muted animate-pulse" />
            </div>
            <p className="text-xs text-center text-muted-foreground">Fetching your programs on Base...</p>
          </div>
        ) : programsWithBalance.length === 0 ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No active programs yet. Get tokens from merchants to see them here!
            </AlertDescription>
          </Alert>
        ) : (
          isMobile ? (
            <div className="relative">
              <div className="overflow-hidden" ref={emblaRef}>
                <div className="flex gap-3">
                  {programsWithBalance.map((program) => {
                    const balance = balances.find(b => b.address === program.address);
                    return (
                      <div key={program.address} className="flex-[0_0_90%] min-w-0">
                        <ProgramCard
                          program={program}
                          balance={balance?.balance || '0'}
                          isExpiringSoon={program.status === 'expiring_soon'}
                          tierSummary={tierSummaries[program.address.toLowerCase()]}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
              {programsWithBalance.length > 1 && (
                <div className="flex justify-center gap-1.5 mt-3">
                  {programsWithBalance.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => emblaApi?.scrollTo(index)}
                      className={`w-2 h-2 rounded-full transition-all ${
                        currentSlide === index 
                          ? 'bg-primary w-4' 
                          : 'bg-muted-foreground/30 hover:bg-muted-foreground/50'
                      }`}
                      aria-label={`Go to slide ${index + 1}`}
                    />
                  ))}
                </div>
              )}
              {programsWithBalance.length > 1 && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 h-8 w-8 rounded-full bg-background/80 shadow-md ${
                      !canScrollPrev ? 'opacity-30 pointer-events-none' : ''
                    }`}
                    onClick={() => emblaApi?.scrollPrev()}
                    disabled={!canScrollPrev}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 h-8 w-8 rounded-full bg-background/80 shadow-md ${
                      !canScrollNext ? 'opacity-30 pointer-events-none' : ''
                    }`}
                    onClick={() => emblaApi?.scrollNext()}
                    disabled={!canScrollNext}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="space-y-3 pr-4 pb-4">
                {programsWithBalance.map((program) => {
                  const balance = balances.find(b => b.address === program.address);
                  return (
                    <ProgramCard
                      key={program.address}
                      program={program}
                      balance={balance?.balance || '0'}
                      isExpiringSoon={program.status === 'expiring_soon'}
                      tierSummary={tierSummaries[program.address.toLowerCase()]}
                    />
                  );
                })}
              </div>
            </ScrollArea>
          )
        )}
      </CardContent>
    </Card>
  );
}

function ProgramCard({
  program,
  balance,
  isExpiringSoon,
  tierSummary,
}: {
  program: TokenInfo;
  balance: string;
  isExpiringSoon: boolean;
  tierSummary?: TierSummary;
}) {
  const { isPaused } = useCheckProgramStatus(program.address as `0x${string}`);
  
  const formatAddress = (addr: string) => {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };
  
  return (
    <div className="p-4 rounded-lg border bg-gradient-to-br from-card to-muted/30 space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold">{program.name}</h3>
            {isPaused ? (
              <Badge variant="secondary" className="bg-gray-500 text-white text-xs">
                Inactive
              </Badge>
            ) : (
              <Badge variant="default" className="bg-green-600 text-xs">
                Active
              </Badge>
            )}
            {isExpiringSoon && (
              <Badge variant="destructive" className="text-xs">
                Expiring Soon
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{program.symbol}</p>
          {tierSummary && (
            <div className="mt-1">
              <CompactTierInline summary={tierSummary} />
            </div>
          )}
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold">
            {parseFloat(balance).toFixed(0)}
          </p>
          <p className="text-xs text-muted-foreground">{program.symbol}</p>
        </div>
      </div>
      
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Store className="h-3 w-3 flex-shrink-0" />
          <span className="font-mono">
            {formatAddress(program.merchantAddress)}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3 w-3 flex-shrink-0" />
          <span>
            Expires: {format(new Date(program.expirationDate), 'MMM dd, yyyy')}
          </span>
        </div>
      </div>
    </div>
  );
}
