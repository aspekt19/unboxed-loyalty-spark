import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TokenListItem } from './TokenListItem';
import { useMultiTokenBalance, type TokenInfo } from '@/hooks/useMultiTokenBalance';
import { useTransferTokens } from '@/hooks/useTransferTokens';
import { CONTRACTS } from '@/config/contracts';
import { toast } from 'sonner';
import { Loader2, Coins, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { usePublicClient, useAccount } from 'wagmi';
import { supabase } from '@/integrations/supabase/client';
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from '@/components/ui/carousel';
import { useIsMobile } from '@/hooks/use-mobile';
import { useFarcasterHaptics } from '@/hooks/useFarcasterHaptics';
import { useTierSummaries } from '@/hooks/useTierSummaries';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { RecipientInput, type RecipientInputType } from '@/components/shared/RecipientInput';
import { useResolveRecipient } from '@/hooks/useResolveRecipient';
import { useActiveWallet } from '@/contexts/ActiveWalletContext';
import { WalletMismatchBanner } from '@/components/identity/WalletMismatchBanner';

interface TokenListProps {
  selectedProgram: string | null;
  onProgramSelect: (address: string) => void;
  filterByMerchant?: string | null;
  /** Clears merchant filter from parent (desktop sidebar + mobile selection) */
  onClearMerchantFilter?: () => void;
}

export function TokenList({ selectedProgram, onProgramSelect, filterByMerchant, onClearMerchantFilter }: TokenListProps) {
  const [selectedToken, setSelectedToken] = useState<TokenInfo | null>(null);
  const [recipientAddress, setRecipientAddress] = useState('');
  const [recipientInputType, setRecipientInputType] = useState<RecipientInputType>('wallet');
  const { resolveRecipient, isResolving } = useResolveRecipient();
  const [transferAmount, setTransferAmount] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [allTokens, setAllTokens] = useState<TokenInfo[]>([]);
  const [isLoadingTokens, setIsLoadingTokens] = useState(true);
  const [activePrograms, setActivePrograms] = useState<Set<string>>(new Set());
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const publicClient = usePublicClient();
  const { address: walletAddress } = useAccount();
  const { activeWallet, isWalletMismatch } = useActiveWallet();
  const { balances, isLoading, refetch } = useMultiTokenBalance(allTokens, activeWallet);
  const { transferTokens, isPending, isSuccess } = useTransferTokens();
  const isMobile = useIsMobile();
  const { selectionChanged } = useFarcasterHaptics();

  // Track if initial load is complete and retry attempts
  const hasLoadedRef = useRef(false);
  const retryCountRef = useRef(0);
  const MAX_RETRIES = 3;

  // Carousel haptic feedback
  useEffect(() => {
    if (!carouselApi) return;

    const onSelect = () => {
      const newSlide = carouselApi.selectedScrollSnap();
      if (newSlide !== currentSlide) {
        selectionChanged();
        setCurrentSlide(newSlide);
      }
    };

    carouselApi.on('select', onSelect);
    return () => {
      carouselApi.off('select', onSelect);
    };
  }, [carouselApi, currentSlide, selectionChanged]);

  const scrollPrev = useCallback(() => {
    carouselApi?.scrollPrev();
    selectionChanged();
  }, [carouselApi, selectionChanged]);

  const scrollNext = useCallback(() => {
    carouselApi?.scrollNext();
    selectionChanged();
  }, [carouselApi, selectionChanged]);

  // Очищаем токены при отключении кошелька
  useEffect(() => {
    if (!walletAddress) {
      setAllTokens([]);
      setSelectedToken(null);
      setRecipientAddress('');
      setTransferAmount('');
      setDialogOpen(false);
      hasLoadedRef.current = false;
      retryCountRef.current = 0;
    }
  }, [walletAddress]);

  // Load tokens from blockchain with retry mechanism
  useEffect(() => {
    if (publicClient && walletAddress && !hasLoadedRef.current) {
      console.log('=== TokenList: Initial load - wallet connected ===');
      console.log('Wallet address:', walletAddress);
      hasLoadedRef.current = true;
      loadTokensFromBlockchain();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicClient, walletAddress]);

  // Listen for session ready events (happens after authentication or when app reopens)
  useEffect(() => {
    const handleSessionReady = () => {
      console.log('Session ready event received, reloading tokens...');
      hasLoadedRef.current = false;
      retryCountRef.current = 0;
      // Small delay to ensure RLS policies are applied
      setTimeout(() => {
        loadTokensFromBlockchain();
        loadActivePrograms();
      }, 500);
    };
    
    window.addEventListener('sessionReady', handleSessionReady);
    window.addEventListener('profileMigrated', handleSessionReady);
    
    return () => {
      window.removeEventListener('sessionReady', handleSessionReady);
      window.removeEventListener('profileMigrated', handleSessionReady);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load active programs from Supabase
  useEffect(() => {
    loadActivePrograms();
    
    // Subscribe to realtime updates
    const channel = supabase
      .channel('loyalty_programs_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'loyalty_programs',
        },
        () => {
          console.log('Loyalty programs changed, reloading active programs...');
          loadActivePrograms();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Listen for loyalty program updates from merchant
  useEffect(() => {
    const handleUpdate = () => {
      console.log('loyaltyProgramsUpdated event received, reloading tokens...');
      hasLoadedRef.current = false;
      retryCountRef.current = 0;
      loadTokensFromBlockchain();
      loadActivePrograms();
    };
    window.addEventListener('loyaltyProgramsUpdated', handleUpdate);
    return () => window.removeEventListener('loyaltyProgramsUpdated', handleUpdate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Listen for token balance updates
  useEffect(() => {
    const handleBalanceUpdate = () => {
      console.log('tokenBalancesUpdated event received, refetching balances...');
      refetch();
    };
    window.addEventListener('tokenBalancesUpdated', handleBalanceUpdate);
    return () => window.removeEventListener('tokenBalancesUpdated', handleBalanceUpdate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Remove refetch from deps to prevent re-subscription

  // Auto-refresh balances every 5 seconds for real-time updates
  useEffect(() => {
    if (!walletAddress || allTokens.length === 0) {
      return;
    }

    console.log('Starting auto-refresh for token balances...');
    const interval = setInterval(() => {
      console.log('Auto-refreshing token balances...');
      refetch(true); // Silent refetch - don't show loading indicator
    }, 5000); // Refresh every 5 seconds

    return () => {
      console.log('Stopping auto-refresh for token balances');
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletAddress, allTokens.length]); // Remove refetch from deps to prevent re-creation

  const loadTokensFromBlockchain = async () => {
    if (!publicClient) {
      console.log('TokenList: No publicClient available');
      // Retry if we haven't exceeded max retries
      if (retryCountRef.current < MAX_RETRIES) {
        retryCountRef.current++;
        console.log(`TokenList: Scheduling retry ${retryCountRef.current}/${MAX_RETRIES}...`);
        setTimeout(() => {
          hasLoadedRef.current = false;
          if (publicClient && walletAddress) {
            loadTokensFromBlockchain();
          }
        }, 2000 * retryCountRef.current); // Exponential backoff
      }
      return;
    }
    
    setIsLoadingTokens(true);
    console.log('TokenList: Loading tokens from database...');
    
    try {
      // Load all active programs from database instead of blockchain events
      // This is more reliable and shows all tokens regardless of when they were created
      const { data: programs, error } = await supabase
        .from('loyalty_programs')
        .select('token_address, name, symbol, merchant_address')
        .in('status', ['active', 'expiring_soon', 'paused']);

      if (error) {
        console.error('TokenList: Error loading programs from database:', error);
        throw error;
      }

      const tokens: TokenInfo[] = programs.map(program => ({
        address: program.token_address,
        name: program.name,
        symbol: program.symbol,
        merchantAddress: program.merchant_address,
      }));

      console.log('TokenList: Loaded tokens from database:', tokens.length);
      setAllTokens(tokens);
      retryCountRef.current = 0; // Reset retry count on success
      
      // Save to localStorage for future use
      if (tokens.length > 0) {
        localStorage.setItem('customerTokens', JSON.stringify(tokens));
      } else {
        // If no tokens found and we haven't exceeded retries, try again
        if (retryCountRef.current < MAX_RETRIES) {
          retryCountRef.current++;
          console.log(`TokenList: No tokens found, scheduling retry ${retryCountRef.current}/${MAX_RETRIES}...`);
          setTimeout(() => {
            hasLoadedRef.current = false;
            loadTokensFromBlockchain();
          }, 3000 * retryCountRef.current);
        }
      }
    } catch (error) {
      console.error('TokenList: Failed to load tokens from database:', error);
      console.log('TokenList: Falling back to localStorage');
      loadTokensFromLocalStorage();
      
      // Retry on error if we haven't exceeded max retries
      if (retryCountRef.current < MAX_RETRIES) {
        retryCountRef.current++;
        console.log(`TokenList: Error occurred, scheduling retry ${retryCountRef.current}/${MAX_RETRIES}...`);
        setTimeout(() => {
          hasLoadedRef.current = false;
          loadTokensFromBlockchain();
        }, 3000 * retryCountRef.current);
      }
    } finally {
      setIsLoadingTokens(false);
    }
  };

  const loadActivePrograms = async () => {
    try {
      const { data, error } = await supabase
        .from('loyalty_programs')
        .select('token_address')
        .in('status', ['active', 'expiring_soon', 'paused']);

      if (error) {
        console.error('Error loading active programs:', error);
        return;
      }

      const activeProgramAddresses = new Set(
        data.map(program => program.token_address.toLowerCase())
      );
      console.log('Active programs loaded:', activeProgramAddresses.size);
      setActivePrograms(activeProgramAddresses);
    } catch (error) {
      console.error('Failed to load active programs:', error);
    }
  };

  const loadTokensFromLocalStorage = () => {
    // Try customer-specific localStorage first, then fall back to merchant's
    const stored = localStorage.getItem('customerTokens') || localStorage.getItem('loyaltyPrograms');
    if (stored) {
      try {
        const programs = JSON.parse(stored);
        const tokens: TokenInfo[] = programs
          .filter((p: any) => p.tokenAddress && p.tokenAddress !== 'pending')
          .map((p: any) => ({
            address: p.tokenAddress || p.address,
            name: p.name,
            symbol: p.symbol,
          }));
        console.log('TokenList: Loaded tokens from localStorage:', tokens);
        setAllTokens(tokens);
      } catch (error) {
        console.error('Failed to load tokens from localStorage:', error);
      }
    } else {
      console.log('TokenList: No tokens in localStorage');
    }
  };

  // Filter to only show tokens with non-zero balances and from active programs
  const tokensWithBalance = balances.filter(token => 
    parseFloat(token.balance) > 0 && 
    (activePrograms.size === 0 || activePrograms.has(token.address.toLowerCase()))
  );

  // Apply merchant filter and search
  const filteredTokens = useMemo(() => {
    let result = tokensWithBalance;
    if (filterByMerchant) {
      result = result.filter(t => t.merchantAddress?.toLowerCase() === filterByMerchant.toLowerCase());
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(t => 
        t.name.toLowerCase().includes(q) || 
        t.symbol.toLowerCase().includes(q)
      );
    }
    return result;
  }, [tokensWithBalance, filterByMerchant, searchQuery]);

  const tierEntries = useMemo(
    () =>
      filteredTokens.map((t) => ({
        tokenAddress: t.address,
        balance: t.balance,
        symbol: t.symbol,
      })),
    [filteredTokens],
  );
  const tierSummaries = useTierSummaries(tierEntries);

  console.log('TokenList render - tokens:', allTokens.length, 'balances:', balances.length, 'with balance:', tokensWithBalance.length);

  // Track previous isSuccess state to detect transitions
  const prevIsSuccessRef = useRef(false);
  
  // Watch for successful transfer - only trigger on transition from false to true
  useEffect(() => {
    if (isSuccess && !prevIsSuccessRef.current && dialogOpen) {
      toast.success('Tokens transferred successfully!');
      setRecipientAddress('');
      setTransferAmount('');
      setSelectedToken(null);
      setDialogOpen(false);
      
      // Refetch balances after a brief delay to ensure transaction is indexed
      setTimeout(() => {
        refetch();
      }, 1000);
    }
    prevIsSuccessRef.current = isSuccess;
  }, [isSuccess, dialogOpen, refetch]);

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isWalletMismatch) {
      toast.error('Reconnect your primary wallet to sign the transfer');
      return;
    }
    if (!selectedToken || !recipientAddress || !transferAmount) {
      toast.error('Please fill all fields');
      return;
    }

    const tokenBalance = balances.find(b => b.address === selectedToken.address);
    if (!tokenBalance || parseFloat(transferAmount) > parseFloat(tokenBalance.balance)) {
      toast.error('Insufficient balance');
      return;
    }

    const resolved = await resolveRecipient(recipientAddress);
    if (!resolved) return;

    await transferTokens(
      selectedToken.address,
      resolved,
      transferAmount,
      CONTRACTS.LOYAL_SPARK_ERC20.abi
    );
  };

  const renderTokenItem = (token: typeof tokensWithBalance[0]) => (
    <TokenListItem
      key={token.address}
      address={token.address}
      name={token.name}
      symbol={token.symbol}
      balance={token.balance}
      merchantAddress={token.merchantAddress}
      tierSummary={tierSummaries[token.address.toLowerCase()]}
      onClick={() => onProgramSelect(token.address)}
      selected={selectedProgram === token.address}
      onSendClick={() => {
        setSelectedToken(token);
        setDialogOpen(true);
      }}
    />
  );

  return (
    <Card className="border-2 bg-gradient-to-br from-card to-muted/30">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Your Loyalty Tokens</CardTitle>
            <CardDescription>
              Each merchant issues their own token. Your tier for each program is shown in one line under the token name.
            </CardDescription>
          </div>
          {isMobile && filteredTokens.length > 1 && (
            <div className="text-sm text-muted-foreground">
              {currentSlide + 1}/{filteredTokens.length}
            </div>
          )}
        </div>
        {tokensWithBalance.length > 2 && (
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or symbol..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        )}
        {filterByMerchant && onClearMerchantFilter && (
          <p className="text-xs text-muted-foreground mt-1">
            Filtered by selected merchant ·{' '}
            <button
              type="button"
              className="underline text-primary font-medium"
              onClick={onClearMerchantFilter}
            >
              Show all
            </button>
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {!walletAddress && (
          <div className="text-center py-8 text-muted-foreground">
            <Coins className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p className="font-semibold">Wallet Not Connected</p>
            <p className="text-sm">Please connect your wallet to view your loyalty tokens</p>
          </div>
        )}
        
        {walletAddress && (isLoading || isLoadingTokens) && (
          <div className="space-y-3 py-4">
            <div className="h-24 rounded-lg bg-muted animate-pulse" />
            <div className="h-24 rounded-lg bg-muted animate-pulse" />
            <p className="text-xs text-center text-muted-foreground">Fetching your tokens on Base...</p>
          </div>
        )}
        
        {walletAddress && !isLoading && !isLoadingTokens && tokensWithBalance.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Coins className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No loyalty tokens yet</p>
            <p className="text-sm">Tokens will appear here when merchants credit them to your wallet</p>
            <p className="text-xs mt-2">Found {allTokens.length} loyalty program(s) total</p>
          </div>
        )}

        {walletAddress && !isLoading && !isLoadingTokens && tokensWithBalance.length > 0 && filteredTokens.length === 0 && (
          <div className="text-center py-6 text-muted-foreground">
            <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No tokens match your search</p>
          </div>
        )}
        
        {filteredTokens.length > 0 && (
          isMobile && filteredTokens.length > 1 ? (
            <div className="relative">
              <Carousel
                setApi={setCarouselApi}
                opts={{
                  align: 'start',
                  loop: false,
                }}
                className="w-full"
              >
                <CarouselContent className="-ml-2">
                  {filteredTokens.map((token) => (
                    <CarouselItem key={token.address} className="pl-2 basis-[90%]">
                      {renderTokenItem(token)}
                    </CarouselItem>
                  ))}
                </CarouselContent>
              </Carousel>
              
              <div className="flex justify-center gap-2 mt-3">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 rounded-full"
                  onClick={scrollPrev}
                  disabled={currentSlide === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="flex items-center gap-1">
                  {filteredTokens.map((_, index) => (
                    <div
                      key={index}
                      className={`h-2 w-2 rounded-full transition-colors ${
                        index === currentSlide ? 'bg-primary' : 'bg-muted'
                      }`}
                    />
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 rounded-full"
                  onClick={scrollNext}
                  disabled={currentSlide === filteredTokens.length - 1}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            <ScrollArea className="h-[330px]">
              <div className="space-y-3 pr-4 pb-4">
                {filteredTokens.map((token) => renderTokenItem(token))}
              </div>
            </ScrollArea>
          )
        )}

        {/* Transfer Dialog - Outside the map to use selectedToken state */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Transfer {selectedToken?.symbol}</DialogTitle>
              <DialogDescription>
                Send {selectedToken?.name} tokens by wallet address, email, or phone number
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleTransfer} className="space-y-4 mt-4">
              <WalletMismatchBanner />
              <RecipientInput
                id="recipient"
                value={recipientAddress}
                onChange={setRecipientAddress}
                inputType={recipientInputType}
                onInputTypeChange={setRecipientInputType}
                disabled={isPending || isResolving}
              />
              <div className="space-y-2">
                <Label htmlFor="transfer-amount">Amount</Label>
                <Input
                  id="transfer-amount"
                  type="number"
                  placeholder="0.00"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  disabled={isPending || isResolving}
                />
                <p className="text-xs text-muted-foreground">
                  Available: {selectedToken ? parseFloat(balances.find(b => b.address === selectedToken.address)?.balance || '0').toFixed(2) : '0.00'} {selectedToken?.symbol}
                </p>
              </div>
              <Button
                type="submit"
                disabled={isPending || isResolving || isWalletMismatch}
                className="w-full"
                title={isWalletMismatch ? 'Reconnect your primary wallet to sign' : undefined}
              >
                {(isPending || isResolving) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isWalletMismatch
                  ? 'Reconnect primary wallet'
                  : isResolving
                    ? 'Looking up recipient...'
                    : 'Transfer Tokens'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}