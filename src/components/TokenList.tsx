import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useMultiTokenBalance, type TokenInfo } from '@/hooks/useMultiTokenBalance';
import { useTransferTokens } from '@/hooks/useTransferTokens';
import { CONTRACTS } from '@/config/contracts';
import { toast } from 'sonner';
import { Loader2, Coins, Gift } from 'lucide-react';
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

interface TokenListProps {
  onSelectProgram: (program: {
    tokenAddress: string;
    tokenSymbol: string;
    programName: string;
  } | null) => void;
  selectedProgram: {
    tokenAddress: string;
    tokenSymbol: string;
    programName: string;
  } | null;
}

export function TokenList({ onSelectProgram, selectedProgram }: TokenListProps) {
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

  // Track if initial load is complete and retry attempts
  const hasLoadedRef = useRef(false);
  const retryCountRef = useRef(0);
  const MAX_RETRIES = 3;

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

  console.log('TokenList render - tokens:', allTokens.length, 'balances:', balances.length, 'with balance:', tokensWithBalance.length);

  // Auto-select first program when tokens load
  useEffect(() => {
    if (tokensWithBalance.length > 0 && !selectedProgram) {
      const firstToken = tokensWithBalance[0];
      onSelectProgram({
        tokenAddress: firstToken.address,
        tokenSymbol: firstToken.symbol,
        programName: firstToken.name,
      });
    }
  }, [tokensWithBalance.length, selectedProgram, onSelectProgram]);

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
    <Card className="border-2 sticky top-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gift className="h-5 w-5 text-primary" />
          Loyalty Programs
        </CardTitle>
        <CardDescription>
          Select a program to view your tier status and manage tokens
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!walletAddress && (
          <div className="text-center py-8 text-muted-foreground">
            <Coins className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p className="font-semibold">Wallet Not Connected</p>
            <p className="text-sm">Please connect your wallet to view your loyalty programs</p>
          </div>
        )}
        
        {walletAddress && (isLoading || isLoadingTokens) && (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading programs...</p>
          </div>
        )}
        
        {walletAddress && !isLoading && !isLoadingTokens && tokensWithBalance.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Coins className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No loyalty programs yet</p>
            <p className="text-sm">Programs will appear here when merchants credit tokens to your wallet</p>
            <p className="text-xs mt-2">Found {allTokens.length} program(s) total</p>
          </div>
        )}
        
        {tokensWithBalance.length > 0 && (
          <ScrollArea className="h-[400px]">
            <div className="space-y-2 pr-4 pb-4">
              {tokensWithBalance.map((token) => {
                const isSelected = selectedProgram?.tokenAddress === token.address;
                return (
                  <button
                    key={token.address}
                    onClick={() => {
                      onSelectProgram({
                        tokenAddress: token.address,
                        tokenSymbol: token.symbol,
                        programName: token.name,
                      });
                      setSelectedToken(token);
                    }}
                    className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                      isSelected
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/50 hover:bg-accent'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-lg">{token.name}</p>
                          <p className="text-sm text-muted-foreground">{token.symbol}</p>
                        </div>
                        {isSelected && (
                          <Badge variant="default">Selected</Badge>
                        )}
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t">
                        <span className="text-sm text-muted-foreground">Balance</span>
                        <span className="font-bold text-lg">
                          {parseFloat(token.balance).toFixed(2)} {token.symbol}
                        </span>
                      </div>
                      {isSelected && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full mt-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDialogOpen(true);
                          }}
                        >
                          Send Tokens
                        </Button>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        )}

        {/* Transfer Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="bg-background z-50">
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
