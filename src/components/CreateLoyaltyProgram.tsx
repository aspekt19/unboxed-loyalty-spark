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
import { Loader2, Plus, CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

export function CreateLoyaltyProgram() {
  const { address } = useAccount();
  const [programName, setProgramName] = useState('');
  const [tokenSymbol, setTokenSymbol] = useState('');
  const [expirationDate, setExpirationDate] = useState<Date>();
  const { deployToken, isPending, isSuccess, deployedTokenAddress } = useDeployLoyaltyToken();
  const savedRef = useRef(false);

  // Очищаем форму при отключении кошелька
  useEffect(() => {
    if (!address) {
      setProgramName('');
      setTokenSymbol('');
      setExpirationDate(undefined);
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

    // Verify that user profile exists and matches wallet address
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
        .single();

      if (profileError || !profile) {
        console.error('Profile verification failed:', profileError);
        toast.error('Profile not found. Please reconnect your wallet.');
        return;
      }

      console.log('Profile verified for program creation:', profile);
    } catch (error) {
      console.error('Profile check error:', error);
      toast.error('Failed to verify profile. Please try again.');
      return;
    }

    savedRef.current = false;
    deployToken(programName, tokenSymbol);
  };

  // Watch for success and handle post-deployment actions
  useEffect(() => {
    if (isSuccess && programName && tokenSymbol && deployedTokenAddress && expirationDate && !savedRef.current) {
      // Сохраняем в БД
      const saveToDatabase = async () => {
        try {
          const { error } = await supabase
            .from('loyalty_programs')
            .insert({
              token_address: deployedTokenAddress.toLowerCase(),
              merchant_address: address!.toLowerCase(),
              name: programName,
              symbol: tokenSymbol,
              expiration_date: expirationDate.toISOString(),
            });

          if (error) {
            console.error('Error saving program to DB:', error);
            toast.error('Program deployed but failed to save to database. Please contact support.');
            return;
          }

          toast.success(`Loyalty program "${programName}" created!`);
          
          // Save to localStorage для обратной совместимости
          const savedPrograms = JSON.parse(localStorage.getItem('loyaltyPrograms') || '[]');
          savedPrograms.push({ 
            name: programName, 
            symbol: tokenSymbol, 
            timestamp: Date.now(),
            tokenAddress: deployedTokenAddress,
            expirationDate: expirationDate.toISOString()
          });
          localStorage.setItem('loyaltyPrograms', JSON.stringify(savedPrograms));
          
          // Clear form after a short delay to show success
          setTimeout(() => {
            setProgramName('');
            setTokenSymbol('');
            setExpirationDate(undefined);
          }, 500);
          
          // Trigger a custom event to notify other components
          window.dispatchEvent(new Event('loyaltyProgramsUpdated'));
        } catch (err) {
          console.error('Unexpected error saving program:', err);
          toast.error('An unexpected error occurred. Please try again.');
        }
      };

      savedRef.current = true;
      saveToDatabase();
    }
  }, [isSuccess, programName, tokenSymbol, deployedTokenAddress, expirationDate, address]);

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
