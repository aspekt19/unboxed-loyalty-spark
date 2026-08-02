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
import { useAccount } from 'wagmi';
import { useActiveCustomerWallet } from '@/hooks/useActiveCustomerWallet';
import { useActiveLoyaltyPrograms } from '@/hooks/useActiveLoyaltyPrograms';
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

/** Carousel on mobile only for a small list; many tokens use vertical scroll */
const MOBILE_CAROUSEL_MAX_ITEMS = 8;

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
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const { address: connectedAddress } = useAccount();
  const { activeAddress } = useActiveCustomerWallet();
  const walletAddress = activeAddress ?? connectedAddress;
  const { data: programs = [], isLoading: isLoadingTokens } = useActiveLoyaltyPrograms();
  const allTokens: TokenInfo[] = useMemo(
    () =>
      programs.map((p) => ({
        address: p.token_address,
        name: p.name,
        symbol: p.symbol,
        merchantAddress: p.merchant_address,
      })),
    [programs],
  );
  const programStandards = useMemo(() => {
    const standards: Record<string, 'erc20' | 'b20'> = {};
    for (const row of programs) {
      standards[row.token_address.toLowerCase()] = row.token_standard === 'b20' ? 'b20' : 'erc20';
    }
    return standards;
  }, [programs]);
  const programDbStatus = useMemo(() => {
    const map: Record<string, string> = {};
    for (const row of programs) {
      map[row.token_address.toLowerCase()] = row.status;
    }
    return map;
  }, [programs]);
  const { balances, isLoading, refetch } = useMultiTokenBalance(allTokens, activeAddress);
  const { transferTokens, isPending, isSuccess } = useTransferTokens();
  const isMobile = useIsMobile();
  const { selectionChanged } = useFarcasterHaptics();

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

  useEffect(() => {
    if (!walletAddress) {
      setSelectedToken(null);
      setRecipientAddress('');
      setTransferAmount('');
      setDialogOpen(false);
    }
  }, [walletAddress]);

  const tokensWithBalance = balances.filter((token) => parseFloat(token.balance) > 0);

  const filteredTokens = useMemo(() => {
    let result = tokensWithBalance;
    if (filterByMerchant) {
      result = result.filter((t) => t.merchantAddress?.toLowerCase() === filterByMerchant.toLowerCase());
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (t) => t.name.toLowerCase().includes(q) || t.symbol.toLowerCase().includes(q),
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

  const prevIsSuccessRef = useRef(false);

  useEffect(() => {
    if (isSuccess && !prevIsSuccessRef.current && dialogOpen) {
      toast.success('Tokens transferred successfully!');
      setRecipientAddress('');
      setTransferAmount('');
      setSelectedToken(null);
      setDialogOpen(false);
      setTimeout(() => {
        void refetch();
      }, 1000);
    }
    prevIsSuccessRef.current = isSuccess;
  }, [isSuccess, dialogOpen, refetch]);

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedToken || !recipientAddress || !transferAmount) {
      toast.error('Please fill all fields');
      return;
    }

    const tokenBalance = balances.find((b) => b.address === selectedToken.address);
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
      CONTRACTS.LOYAL_SPARK_ERC20.abi,
    );
  };

  const renderTokenItem = (token: (typeof tokensWithBalance)[0]) => (
    <TokenListItem
      key={token.address}
      address={token.address}
      name={token.name}
      symbol={token.symbol}
      balance={token.balance}
      merchantAddress={token.merchantAddress}
      tierSummary={tierSummaries[token.address.toLowerCase()]}
      tokenStandard={programStandards[token.address.toLowerCase()]}
      dbStatus={programDbStatus[token.address.toLowerCase()]}
      onClick={() => onProgramSelect(token.address)}
      selected={selectedProgram === token.address}
      onSendClick={() => {
        setSelectedToken(token);
        setDialogOpen(true);
      }}
    />
  );

  const showMobileCarousel =
    isMobile &&
    filteredTokens.length > 1 &&
    filteredTokens.length <= MOBILE_CAROUSEL_MAX_ITEMS;

  return (
    <Card className="border-2 bg-gradient-to-br from-card to-muted/30 overflow-hidden">
      <CardHeader className="space-y-2">
        <div className="flex items-start justify-between gap-3 min-w-0">
          <CardTitle className="min-w-0 flex items-center gap-2 text-lg sm:text-2xl leading-tight">
            <Coins className="h-5 w-5 text-primary flex-shrink-0" />
            Your Loyalty Tokens
          </CardTitle>
          {showMobileCarousel && (
            <span className="text-xs text-muted-foreground tabular-nums shrink-0 pt-0.5">
              {currentSlide + 1}/{filteredTokens.length}
            </span>
          )}
        </div>
        <CardDescription className="text-xs sm:text-sm">
          Each merchant issues their own token. Your tier for each program is shown in one line under the token name.
        </CardDescription>
        {tokensWithBalance.length > 2 && (
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or symbol..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
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
      <CardContent className="space-y-4 min-w-0 overflow-hidden">
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

        {walletAddress &&
          !isLoading &&
          !isLoadingTokens &&
          tokensWithBalance.length > 0 &&
          filteredTokens.length === 0 && (
            <div className="text-center py-6 text-muted-foreground">
              <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No tokens match your search</p>
            </div>
          )}

        {filteredTokens.length > 0 &&
          (showMobileCarousel ? (
            <div className="relative min-w-0 overflow-hidden">
              <Carousel
                setApi={setCarouselApi}
                opts={{
                  align: 'start',
                  loop: false,
                }}
                className="w-full min-w-0"
              >
                <CarouselContent className="-ml-2">
                  {filteredTokens.map((token) => (
                    <CarouselItem key={token.address} className="pl-2 basis-[90%] min-w-0">
                      {renderTokenItem(token)}
                    </CarouselItem>
                  ))}
                </CarouselContent>
              </Carousel>

              <div className="flex items-center justify-center gap-3 mt-3">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 shrink-0 rounded-full"
                  onClick={scrollPrev}
                  disabled={currentSlide === 0}
                  aria-label="Previous token"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs text-muted-foreground tabular-nums min-w-[3.5rem] text-center">
                  {currentSlide + 1} / {filteredTokens.length}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 shrink-0 rounded-full"
                  onClick={scrollNext}
                  disabled={currentSlide === filteredTokens.length - 1}
                  aria-label="Next token"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            <ScrollArea className={isMobile ? 'h-[min(55vh,420px)]' : 'h-[330px]'}>
              <div className="space-y-3 pr-4 pb-4">
                {filteredTokens.map((token) => renderTokenItem(token))}
              </div>
            </ScrollArea>
          ))}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Transfer {selectedToken?.symbol}</DialogTitle>
              <DialogDescription>
                Send {selectedToken?.name} tokens by wallet address, email, or phone number
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleTransfer} className="space-y-3 sm:space-y-4 mt-3 sm:mt-4">
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
                  Available:{' '}
                  {selectedToken
                    ? parseFloat(
                        balances.find((b) => b.address === selectedToken.address)?.balance || '0',
                      ).toFixed(2)
                    : '0.00'}{' '}
                  {selectedToken?.symbol}
                </p>
              </div>
              <Button type="submit" disabled={isPending || isResolving} className="w-full">
                {(isPending || isResolving) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isResolving ? 'Looking up recipient...' : 'Transfer Tokens'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
