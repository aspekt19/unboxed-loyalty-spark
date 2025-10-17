import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useMultiTokenBalance, type TokenInfo } from '@/hooks/useMultiTokenBalance';
import { useTransferTokens } from '@/hooks/useTransferTokens';
import { CONTRACTS } from '@/config/contracts';
import { toast } from 'sonner';
import { Loader2, Send, Coins } from 'lucide-react';
import { usePublicClient, useAccount } from 'wagmi';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export function TokenList() {
  const [selectedToken, setSelectedToken] = useState<TokenInfo | null>(null);
  const [recipientAddress, setRecipientAddress] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [allTokens, setAllTokens] = useState<TokenInfo[]>([]);
  const [isLoadingTokens, setIsLoadingTokens] = useState(true);

  const publicClient = usePublicClient();
  const { address: walletAddress } = useAccount();
  const { balances, isLoading, refetch } = useMultiTokenBalance(allTokens);
  const { transferTokens, isPending, isSuccess } = useTransferTokens();

  // Debug log when wallet connects
  useEffect(() => {
    console.log('TokenList: Wallet address changed:', walletAddress);
  }, [walletAddress]);

  // Load tokens on mount and when wallet connects
  useEffect(() => {
    console.log('TokenList: Loading tokens, publicClient:', !!publicClient);
    loadTokensFromBlockchain();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicClient]);

  // Listen for loyalty program updates
  useEffect(() => {
    const handleUpdate = () => {
      console.log('loyaltyProgramsUpdated event received, refetching...');
      loadTokensFromBlockchain();
      // Also refetch balances after a short delay to allow blockchain to update
      setTimeout(() => {
        console.log('Refetching balances after program update');
        refetch();
      }, 2000);
    };
    window.addEventListener('loyaltyProgramsUpdated', handleUpdate);
    return () => window.removeEventListener('loyaltyProgramsUpdated', handleUpdate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadTokensFromBlockchain = async () => {
    if (!publicClient) {
      console.log('TokenList: No publicClient available');
      return;
    }
    
    setIsLoadingTokens(true);
    console.log('TokenList: Loading tokens from blockchain...');
    console.log('TokenList: Factory address:', CONTRACTS.LOYALTY_TOKEN_FACTORY.address);
    
    try {
      // Fetch all LoyaltyTokenCreated events from the factory contract
      const logs = await publicClient.getLogs({
        address: CONTRACTS.LOYALTY_TOKEN_FACTORY.address,
        event: {
          type: 'event',
          name: 'LoyaltyTokenCreated',
          inputs: [
            { type: 'address', name: 'tokenAddress', indexed: true },
            { type: 'address', name: 'merchantAddress', indexed: true },
            { type: 'string', name: 'name', indexed: false },
            { type: 'string', name: 'symbol', indexed: false },
          ],
        },
        fromBlock: 'earliest',
        toBlock: 'latest',
      });

      console.log('TokenList: Loaded loyalty tokens from blockchain:', logs.length);

      const tokens: TokenInfo[] = logs.map((log: any) => ({
        address: log.args.tokenAddress,
        name: log.args.name,
        symbol: log.args.symbol,
      }));

      console.log('TokenList: Parsed tokens:', tokens);
      setAllTokens(tokens);
      
      // Trigger balance fetch after tokens are set
      setTimeout(() => {
        console.log('TokenList: Triggering balance refetch');
        refetch();
      }, 500);
    } catch (error) {
      console.error('TokenList: Failed to load tokens from blockchain:', error);
      // Fallback to localStorage if blockchain query fails
      loadTokensFromLocalStorage();
    } finally {
      setIsLoadingTokens(false);
    }
  };

  const loadTokensFromLocalStorage = () => {
    const stored = localStorage.getItem('loyaltyPrograms');
    if (stored) {
      try {
        const programs = JSON.parse(stored);
        const tokens: TokenInfo[] = programs
          .filter((p: any) => p.tokenAddress && p.tokenAddress !== 'pending')
          .map((p: any) => ({
            address: p.tokenAddress,
            name: p.name,
            symbol: p.symbol,
          }));
        setAllTokens(tokens);
      } catch (error) {
        console.error('Failed to load tokens from localStorage:', error);
      }
    }
  };

  // Filter to only show tokens with non-zero balances
  const tokensWithBalance = balances.filter(token => 
    parseFloat(token.balance) > 0
  );

  // Debug log balances
  useEffect(() => {
    console.log('TokenList: All tokens:', allTokens);
    console.log('TokenList: All balances:', balances);
    console.log('TokenList: Tokens with balance:', tokensWithBalance);
  }, [allTokens, balances, tokensWithBalance]);

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

    if (isSuccess) {
      toast.success('Tokens transferred successfully!');
      setRecipientAddress('');
      setTransferAmount('');
      setDialogOpen(false);
      refetch();
    }
  };

  return (
    <Card className="border-2 bg-gradient-to-br from-card to-muted/30">
      <CardHeader>
        <CardTitle>Your Loyalty Tokens</CardTitle>
        <CardDescription>Manage tokens from different merchants</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {(isLoading || isLoadingTokens) && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}
        
        {!isLoading && !isLoadingTokens && tokensWithBalance.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Coins className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No loyalty tokens yet</p>
            <p className="text-sm">Tokens will appear here when merchants credit them to your wallet</p>
          </div>
        )}
        
        {tokensWithBalance.map((token) => (
          <div
            key={token.address}
            className="flex items-center justify-between p-4 rounded-lg bg-gradient-to-r from-primary/5 to-secondary/5 border-2 border-primary/10 hover:border-primary/30 transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                <Coins className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <p className="font-semibold">{token.name}</p>
                <p className="text-sm text-muted-foreground">{token.symbol}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-2xl font-bold">
                  {parseFloat(token.balance).toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground">{token.symbol}</p>
              </div>

              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    size="sm"
                    onClick={() => setSelectedToken(token)}
                    className="bg-gradient-to-r from-primary to-secondary hover:opacity-90"
                  >
                    <Send className="h-4 w-4 mr-1" />
                    Send
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Transfer {token.symbol}</DialogTitle>
                    <DialogDescription>
                      Send {token.name} tokens to another address
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
                        Available: {parseFloat(token.balance).toFixed(2)} {token.symbol}
                      </p>
                    </div>
                    <Button type="submit" disabled={isPending} className="w-full">
                      {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Transfer Tokens
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
