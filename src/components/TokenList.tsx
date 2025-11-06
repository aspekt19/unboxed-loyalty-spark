import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TokenListItem } from './TokenListItem';
import { useMultiTokenBalance, type TokenInfo } from '@/hooks/useMultiTokenBalance';
import { useTransferTokens } from '@/hooks/useTransferTokens';
import { CONTRACTS } from '@/config/contracts';
import { toast } from 'sonner';
import { Loader2, Coins } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { usePublicClient, useAccount } from 'wagmi';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export function TokenList() {
  const [selectedToken, setSelectedToken] = useState<TokenInfo | null>(null);
  const [recipientAddress, setRecipientAddress] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [allTokens, setAllTokens] = useState<TokenInfo[]>([]);
  const [isLoadingTokens, setIsLoadingTokens] = useState(true);
  const [activePrograms, setActivePrograms] = useState<Set<string>>(new Set());

  const publicClient = usePublicClient();
  const { address: walletAddress } = useAccount();
  const { balances, isLoading, refetch } = useMultiTokenBalance(allTokens);
  const { transferTokens, isPending, isSuccess } = useTransferTokens();

  // Track if initial load is complete
  const hasLoadedRef = useRef(false);

  // Очищаем токены при отключении кошелька
  useEffect(() => {
    if (!walletAddress) {
      setAllTokens([]);
      setSelectedToken(null);
      setRecipientAddress('');
      setTransferAmount('');
      setDialogOpen(false);
      hasLoadedRef.current = false;
    }
  }, [walletAddress]);

  // Load tokens from blockchain once when component mounts or wallet connects
  useEffect(() => {
    if (publicClient && walletAddress && !hasLoadedRef.current) {
      console.log('=== TokenList: Initial load - wallet connected ===');
      console.log('Wallet address:', walletAddress);
      hasLoadedRef.current = true;
      loadTokensFromBlockchain();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicClient, walletAddress]);

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
      hasLoadedRef.current = false; // Allow reload
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
      return;
    }
    
    setIsLoadingTokens(true);
    console.log('TokenList: Loading tokens from blockchain...');
    console.log('TokenList: Factory address:', CONTRACTS.LOYALTY_TOKEN_FACTORY.address);
    
    try {
      // Get current block
      const currentBlock = await publicClient.getBlockNumber();
      console.log('TokenList: Current block:', currentBlock);
      
      // Find the LoyaltyTokenCreated event ABI
      const eventAbi = CONTRACTS.LOYALTY_TOKEN_FACTORY.abi.find(
        (item) => item.type === 'event' && item.name === 'LoyaltyTokenCreated'
      ) as any;

      if (!eventAbi) {
        console.error('TokenList: LoyaltyTokenCreated event not found in ABI');
        loadTokensFromLocalStorage();
        setIsLoadingTokens(false);
        return;
      }

      // Query in chunks to avoid "exceed maximum block range" error
      const CHUNK_SIZE = 40000n; // Stay under 50k limit
      const LOOKBACK_BLOCKS = 200000n; // ~5 days on Base (2 sec blocks)
      const fromBlock = currentBlock > LOOKBACK_BLOCKS ? currentBlock - LOOKBACK_BLOCKS : 0n;
      
      console.log('TokenList: Querying from block:', fromBlock, 'to', currentBlock);

      let allLogs: any[] = [];
      let currentChunkStart = fromBlock;

      while (currentChunkStart <= currentBlock) {
        const currentChunkEnd = currentChunkStart + CHUNK_SIZE > currentBlock 
          ? currentBlock 
          : currentChunkStart + CHUNK_SIZE;

        console.log(`TokenList: Querying chunk ${currentChunkStart} to ${currentChunkEnd}`);

        try {
          const logs = await publicClient.getLogs({
            address: CONTRACTS.LOYALTY_TOKEN_FACTORY.address,
            event: eventAbi,
            fromBlock: currentChunkStart,
            toBlock: currentChunkEnd,
          });

          allLogs = [...allLogs, ...logs];
          console.log(`TokenList: Found ${logs.length} events in this chunk`);
        } catch (chunkError) {
          console.error(`TokenList: Error querying chunk:`, chunkError);
        }

        currentChunkStart = currentChunkEnd + 1n;
      }

      console.log('TokenList: Total events found:', allLogs.length);

      const tokens: TokenInfo[] = allLogs.map((log: any) => ({
        address: log.args.tokenAddress,
        name: log.args.name,
        symbol: log.args.symbol,
      }));

      // Load merchant addresses from database
      const { data: programs } = await supabase
        .from('loyalty_programs')
        .select('token_address, merchant_address')
        .in('token_address', tokens.map(t => t.address));

      const merchantMap = new Map(
        programs?.map(p => [p.token_address.toLowerCase(), p.merchant_address]) || []
      );

      const tokensWithMerchant = tokens.map(token => ({
        ...token,
        merchantAddress: merchantMap.get(token.address.toLowerCase()),
      }));

      console.log('TokenList: Parsed tokens:', tokensWithMerchant);
      setAllTokens(tokensWithMerchant);
      
      // Save to localStorage for future use
      if (tokensWithMerchant.length > 0) {
        localStorage.setItem('customerTokens', JSON.stringify(tokensWithMerchant));
      }
    } catch (error) {
      console.error('TokenList: Failed to load tokens from blockchain:', error);
      console.log('TokenList: Falling back to localStorage');
      loadTokensFromLocalStorage();
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
    
    if (!selectedToken || !recipientAddress || !transferAmount) {
      toast.error('Please fill all fields');
      return;
    }

    const tokenBalance = balances.find(b => b.address === selectedToken.address);
    if (!tokenBalance || parseFloat(transferAmount) > parseFloat(tokenBalance.balance)) {
      toast.error('Insufficient balance');
      return;
    }

    await transferTokens(
      selectedToken.address,
      recipientAddress,
      transferAmount,
      CONTRACTS.LOYAL_SPARK_ERC20.abi
    );
  };

  return (
    <Card className="border-2 bg-gradient-to-br from-card to-muted/30">
      <CardHeader>
        <CardTitle>Your Loyalty Tokens</CardTitle>
        <CardDescription>
          {walletAddress ? (
            <>Manage tokens from different merchants - Connected: {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}</>
          ) : (
            <>Please connect your wallet to view your tokens</>
          )}
        </CardDescription>
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
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading tokens...</p>
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
        
        {tokensWithBalance.length > 0 && (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-4">
              {tokensWithBalance.map((token) => (
                <TokenListItem
                  key={token.address}
                  address={token.address}
                  name={token.name}
                  symbol={token.symbol}
                  balance={token.balance}
                  merchantAddress={token.merchantAddress}
                  onSendClick={() => {
                    setSelectedToken(token);
                    setDialogOpen(true);
                  }}
                />
              ))}
            </div>
          </ScrollArea>
        )}

        {/* Transfer Dialog - Outside the map to use selectedToken state */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Transfer {selectedToken?.symbol}</DialogTitle>
              <DialogDescription>
                Send {selectedToken?.name} tokens to another address
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleTransfer} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="recipient">Recipient Address</Label>
                <Input
                  id="recipient"
                  placeholder="0x..."
                  value={recipientAddress}
                  onChange={(e) => setRecipientAddress(e.target.value)}
                  disabled={isPending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="transfer-amount">Amount</Label>
                <Input
                  id="transfer-amount"
                  type="number"
                  placeholder="0.00"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  disabled={isPending}
                />
                <p className="text-xs text-muted-foreground">
                  Available: {selectedToken ? parseFloat(balances.find(b => b.address === selectedToken.address)?.balance || '0').toFixed(2) : '0.00'} {selectedToken?.symbol}
                </p>
              </div>
              <Button type="submit" disabled={isPending} className="w-full">
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Transfer Tokens
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
