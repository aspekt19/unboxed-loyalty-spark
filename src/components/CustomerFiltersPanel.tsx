import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAccount } from 'wagmi';
import { Gift, Loader2, AlertCircle, Store, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useMultiTokenBalance } from '@/hooks/useMultiTokenBalance';
import { useCheckProgramStatus } from '@/hooks/useCheckProgramStatus';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import useEmblaCarousel from 'embla-carousel-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useFarcasterHaptics } from '@/hooks/useFarcasterHaptics';

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

export function CustomerFiltersPanel() {
  const { address } = useAccount();
  const [programs, setPrograms] = useState<TokenInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const isMobile = useIsMobile();
  const { selectionChanged, impactOccurred } = useFarcasterHaptics();
  // Embla carousel for mobile swipe
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
      selectionChanged(); // Haptic feedback on slide change
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

  const { balances, isLoading: balancesLoading, refetch } = useMultiTokenBalance(programs);

  // Load active programs from Supabase
  useEffect(() => {
    if (!address) {
      setPrograms([]);
      return;
    }

    loadActivePrograms();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('customer_loyalty_programs')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'loyalty_programs',
        },
        () => {
          console.log('Programs updated, reloading...');
          loadActivePrograms();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [address]);

  // Listen for token balance updates
  useEffect(() => {
    const handleBalanceUpdate = () => {
      console.log('tokenBalancesUpdated event received in filters, refetching balances...');
      refetch(true); // Silent refetch
    };
    window.addEventListener('tokenBalancesUpdated', handleBalanceUpdate);
    return () => window.removeEventListener('tokenBalancesUpdated', handleBalanceUpdate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Remove refetch from deps to prevent re-subscription

  // Auto-refresh balances every 5 seconds for real-time updates
  useEffect(() => {
    if (!address || programs.length === 0) {
      return;
    }

    console.log('Starting auto-refresh for customer filters balances...');
    const interval = setInterval(() => {
      refetch(true); // Silent refetch
    }, 5000);

    return () => {
      console.log('Stopping auto-refresh for customer filters balances');
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, programs.length]); // Remove refetch from deps to prevent re-creation

  const loadActivePrograms = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('loyalty_programs')
        .select('*')
        .in('status', ['active', 'expiring_soon', 'paused'])
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading programs:', error);
        return;
      }

      const programsData: TokenInfo[] = data.map((prog: LoyaltyProgram) => ({
        address: prog.token_address,
        name: prog.name,
        symbol: prog.symbol,
        status: prog.status,
        expirationDate: prog.expiration_date,
        merchantAddress: prog.merchant_address,
      }));

      setPrograms(programsData);
    } catch (error) {
      console.error('Failed to load programs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter programs with non-zero balance
  const programsWithBalance = programs.filter(program => {
    const balance = balances.find(b => b.address === program.address);
    return balance && parseFloat(balance.balance) > 0;
  });

  if (!address) {
    return null;
  }

  return (
    <Card className="border-2 h-full flex flex-col">
      <CardHeader className="flex-shrink-0">
        <CardTitle className="flex items-center gap-2">
          <Gift className="h-5 w-5 text-primary" />
          Loyalty Programs
        </CardTitle>
        <CardDescription>Your loyalty programs overview</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden flex flex-col">
        {isLoading || balancesLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="ml-2 text-sm text-muted-foreground">Loading...</span>
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
            // Mobile: Swipeable carousel
            <div className="relative">
              <div className="overflow-hidden" ref={emblaRef}>
                <div className="flex gap-3">
                  {programsWithBalance.map((program) => {
                    const balance = balances.find(b => b.address === program.address);
                    const isExpiringSoon = program.status === 'expiring_soon';
                    
                    return (
                      <div 
                        key={program.address} 
                        className="flex-[0_0_90%] min-w-0"
                      >
                        <ProgramCard
                          program={program}
                          balance={balance?.balance || '0'}
                          isExpiringSoon={isExpiringSoon}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
              {/* Carousel indicators */}
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
              {/* Navigation arrows */}
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
            // Desktop: ScrollArea list
            <ScrollArea className="h-[500px]">
              <div className="space-y-3 pr-4 pb-4">
                {programsWithBalance.map((program) => {
                  const balance = balances.find(b => b.address === program.address);
                  const isExpiringSoon = program.status === 'expiring_soon';
                  
                  return (
                    <ProgramCard
                      key={program.address}
                      program={program}
                      balance={balance?.balance || '0'}
                      isExpiringSoon={isExpiringSoon}
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

function ProgramCard({ program, balance, isExpiringSoon }: { 
  program: TokenInfo; 
  balance: string; 
  isExpiringSoon: boolean;
}) {
  const { isPaused } = useCheckProgramStatus(program.address as `0x${string}`);
  
  const formatAddress = (address: string) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
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
