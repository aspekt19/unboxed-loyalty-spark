import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useDeployLoyaltyToken } from '@/hooks/useDeployLoyaltyToken';
import { useAccount } from 'wagmi';
import { toast } from 'sonner';
import { Loader2, Plus, CalendarIcon, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

export function CreateLoyaltyProgram() {
  const { address } = useAccount();
  const [programName, setProgramName] = useState('');
  const [tokenSymbol, setTokenSymbol] = useState('');
  const [expirationDate, setExpirationDate] = useState<Date>();
  const [cashbackRate, setCashbackRate] = useState<string>('5');
  const [pointsPerDollar, setPointsPerDollar] = useState<string>('1');
  const { deployToken, isPending, isSuccess, deployedTokenAddress } = useDeployLoyaltyToken();
  const savedRef = useRef(false);

  // Clear form on wallet disconnect
  useEffect(() => {
    if (!address) {
      setProgramName('');
      setTokenSymbol('');
      setExpirationDate(undefined);
      setCashbackRate('5');
      setPointsPerDollar('1');
    }
  }, [address]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!address) {
      toast.error('Please connect your wallet first');
      return;
    }
    
    if (!programName || !tokenSymbol) {
      toast.error('Please fill all fields');
      return;
    }

    if (!expirationDate) {
      toast.error('Please select expiration date');
      return;
    }

    if (expirationDate <= new Date()) {
      toast.error('Expiration date must be in the future');
      return;
    }

    const cashbackNum = parseFloat(cashbackRate);
    const pointsNum = parseFloat(pointsPerDollar);
    if (isNaN(cashbackNum) || cashbackNum < 1 || cashbackNum > 50) {
      toast.error('Cashback rate must be between 1% and 50%');
      return;
    }
    if (isNaN(pointsNum) || pointsNum <= 0 || pointsNum > 1000) {
      toast.error('Points per dollar must be between 0.01 and 1000');
      return;
    }

    // Verify user profile exists and matches wallet
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user) {
        toast.error('Please sign in with your wallet first');
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, wallet_address')
        .eq('wallet_address', address.toLowerCase())
        .eq('user_id', session.session.user.id)
        .maybeSingle();

      if (profileError || !profile) {
        console.error('[CreateLoyaltyProgram] Profile verification failed:', profileError?.message);
        toast.error('Profile not found. Please reconnect your wallet.');
        return;
      }
    } catch (error) {
      console.error('[CreateLoyaltyProgram] Profile check error:', error);
      toast.error('Failed to verify profile. Please try again.');
      return;
    }

    savedRef.current = false;
    deployToken(programName, tokenSymbol);
  };

  // Save program to DB after successful deployment
  useEffect(() => {
    if (isSuccess && programName && tokenSymbol && deployedTokenAddress && expirationDate && !savedRef.current) {
      const saveToDatabase = async () => {
        try {
          const { data: session } = await supabase.auth.getSession();
          if (!session?.session?.user) {
            toast.error('Session expired. Please sign in again and redeploy.');
            return;
          }

          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('user_id, wallet_address')
            .eq('wallet_address', address!.toLowerCase())
            .eq('user_id', session.session.user.id)
            .maybeSingle();

          if (profileError || !profile) {
            console.error('[CreateLoyaltyProgram] Profile not found for save');
            toast.error('Profile not found. Please reconnect your wallet.');
            return;
          }

          const { error } = await supabase
            .from('loyalty_programs')
            .insert({
              token_address: deployedTokenAddress.toLowerCase(),
              merchant_address: address!.toLowerCase(),
              name: programName,
              symbol: tokenSymbol,
              expiration_date: expirationDate.toISOString(),
              status: 'inactive',
              cashback_rate: parseFloat(cashbackRate),
              points_per_dollar: parseFloat(pointsPerDollar),
            });

          if (error) {
            console.error('[CreateLoyaltyProgram] Save error:', error.message, error.code);
            
            if (error.code === '42501') {
              toast.error('Permission denied. Please reconnect your wallet and try again.');
            } else if (error.code === '23505') {
              toast.error('This program already exists in the database.');
            } else {
              toast.error(`Failed to save program: ${error.message}`);
            }
            return;
          }

          toast.success(`Loyalty program "${programName}" created! Activate it to start issuing tokens.`);
          
          // localStorage for backward compatibility
          const savedPrograms = JSON.parse(localStorage.getItem('loyaltyPrograms') || '[]');
          savedPrograms.push({ 
            name: programName, 
            symbol: tokenSymbol, 
            timestamp: Date.now(),
            tokenAddress: deployedTokenAddress,
            expirationDate: expirationDate.toISOString()
          });
          localStorage.setItem('loyaltyPrograms', JSON.stringify(savedPrograms));
          
          setTimeout(() => {
            setProgramName('');
            setTokenSymbol('');
            setExpirationDate(undefined);
            setCashbackRate('5');
            setPointsPerDollar('1');
          }, 500);
          
          window.dispatchEvent(new Event('loyaltyProgramsUpdated'));
        } catch (err) {
          console.error('[CreateLoyaltyProgram] Unexpected error:', err);
          toast.error('An unexpected error occurred. Please try again.');
        }
      };

      savedRef.current = true;
      saveToDatabase();
    }
  }, [isSuccess, programName, tokenSymbol, deployedTokenAddress, expirationDate, cashbackRate, pointsPerDollar, address]);

  return (
    <Card className="border-2 bg-gradient-to-br from-card to-muted/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="h-5 w-5 text-primary" />
          Create Loyalty Program
        </CardTitle>
        <CardDescription>Deploy a new loyalty token on BASE</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="program-name">Program Name</Label>
            <Input
              id="program-name"
              placeholder="e.g., Coffee Shop Rewards"
              value={programName}
              onChange={(e) => setProgramName(e.target.value)}
              disabled={isPending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="token-symbol">Token Symbol</Label>
            <Input
              id="token-symbol"
              placeholder="e.g., COFFEE"
              value={tokenSymbol}
              onChange={(e) => setTokenSymbol(e.target.value.toUpperCase())}
              disabled={isPending}
              maxLength={10}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="expiration-date">Program Expiration Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="expiration-date"
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !expirationDate && "text-muted-foreground"
                  )}
                  disabled={isPending}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {expirationDate ? format(expirationDate, "PPP") : <span>Pick expiration date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={expirationDate}
                  onSelect={setExpirationDate}
                  disabled={(date) => date < new Date()}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
            <p className="text-xs text-muted-foreground">
              After this date, you'll have 24 hours to extend or close the program
            </p>
          </div>
          <TooltipProvider delayDuration={150}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Label htmlFor="cashback-rate">Cashback Rate (%)</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button type="button" className="text-muted-foreground hover:text-foreground transition-colors" aria-label="Cashback rate info">
                        <Info className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">
                      <p className="text-xs leading-relaxed">
                        Percentage of each purchase returned as loyalty tokens.
                        <br />
                        <span className="text-muted-foreground">Allowed: 1% – 50% · step 0.5%</span>
                        <br />
                        Example: 5% on a $20 purchase → 1 token credited.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Input
                  id="cashback-rate"
                  type="number"
                  min="1"
                  max="50"
                  step="any"
                  placeholder="5"
                  lang="en"
                  value={cashbackRate}
                  onChange={(e) => setCashbackRate(e.target.value)}
                  disabled={isPending}
                />
                <p className="text-xs text-muted-foreground">
                  Range: <span className="font-medium text-foreground">1–50%</span> · Default 5% · Unit: percent of purchase
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Label htmlFor="points-per-dollar">Points per $1</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button type="button" className="text-muted-foreground hover:text-foreground transition-colors" aria-label="Points per dollar info">
                        <Info className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">
                      <p className="text-xs leading-relaxed">
                        How many tokens equal $1 of value when crediting cashback.
                        <br />
                        <span className="text-muted-foreground">Allowed: 0.01 – 1000 tokens/$ · step 0.1</span>
                        <br />
                        Formula: amount × (cashback / 100) × points_per_$1.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Input
                  id="points-per-dollar"
                  type="number"
                  min="0.01"
                  max="1000"
                  step="any"
                  placeholder="1"
                  lang="en"
                  value={pointsPerDollar}
                  onChange={(e) => setPointsPerDollar(e.target.value)}
                  disabled={isPending}
                />
                <p className="text-xs text-muted-foreground">
                  Range: <span className="font-medium text-foreground">0.01–1000</span> · Default 1 · Unit: tokens per $1
                </p>
              </div>
            </div>
          </TooltipProvider>
          <Button 
            type="submit" 
            disabled={isPending} 
            className="w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90 h-12 text-base font-semibold touch-manipulation"
          >
            {isPending && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
            Deploy Program
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
