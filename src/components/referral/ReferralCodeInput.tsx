import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Gift, Check, AlertCircle, PartyPopper } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';

const referralCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .length(6, 'Referral code must be 6 characters')
    .regex(/^[A-Z0-9]+$/, 'Code must contain only letters and numbers'),
  tokenAddress: z
    .string()
    .trim()
    .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid token address'),
});

interface LoyaltyProgram {
  token_address: string;
  name: string;
  symbol: string;
  referee_bonus: number;
  referrer_bonus: number;
}

export function ReferralCodeInput() {
  const { address } = useAccount();
  const [code, setCode] = useState('');
  const [selectedProgram, setSelectedProgram] = useState<string>('');
  const [programs, setPrograms] = useState<LoyaltyProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [alreadyUsed, setAlreadyUsed] = useState<string[]>([]);

  useEffect(() => {
    if (!address) return;
    loadPrograms();
  }, [address]);

  const loadPrograms = async () => {
    if (!address) return;

    try {
      setLoading(true);

      // Получаем активные программы лояльности
      const { data: loyaltyPrograms } = await supabase
        .from('loyalty_programs')
        .select('token_address, name, symbol')
        .eq('status', 'active');

      if (!loyaltyPrograms || loyaltyPrograms.length === 0) {
        setPrograms([]);
        return;
      }

      // Получаем реферальные программы
      const { data: referralPrograms } = await supabase
        .from('referral_programs')
        .select('token_address, referee_bonus, referrer_bonus')
        .in(
          'token_address',
          loyaltyPrograms.map((p) => p.token_address)
        )
        .eq('is_active', true);

      if (!referralPrograms) {
        setPrograms([]);
        return;
      }

      // Проверяем, для каких программ пользователь уже использовал реферальный код
      const { data: existingReferrals } = await supabase
        .from('referrals')
        .select('token_address')
        .eq('referee_address', address.toLowerCase());

      const usedTokens = existingReferrals?.map((r) => r.token_address) || [];
      setAlreadyUsed(usedTokens);

      // Объединяем данные
      const combinedPrograms = loyaltyPrograms
        .map((lp) => {
          const rp = referralPrograms.find((r) => r.token_address === lp.token_address);
          if (!rp) return null;
          return {
            token_address: lp.token_address,
            name: lp.name,
            symbol: lp.symbol,
            referee_bonus: Number(rp.referee_bonus),
            referrer_bonus: Number(rp.referrer_bonus),
          };
        })
        .filter((p): p is LoyaltyProgram => p !== null);

      setPrograms(combinedPrograms);
    } catch (err) {
      console.error('Error loading programs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!address || !selectedProgram) {
      toast.error('Please select a program');
      return;
    }

    // Проверяем, не использовал ли пользователь уже код для этой программы
    if (alreadyUsed.includes(selectedProgram)) {
      toast.error('You have already used a referral code for this program');
      return;
    }

    // Валидация с помощью zod
    const validation = referralCodeSchema.safeParse({
      code,
      tokenAddress: selectedProgram,
    });

    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }

    try {
      setSubmitting(true);

      // Вызываем функцию обработки реферала
      const { data, error } = await supabase.rpc('process_referral', {
        p_token_address: selectedProgram,
        p_referee_address: address.toLowerCase(),
        p_referral_code: code.toUpperCase(),
      });

      if (error) {
        console.error('Error processing referral:', error);
        toast.error('Failed to apply referral code');
        return;
      }

      if (data === false) {
        toast.error('Invalid referral code or code already used');
        return;
      }

      // Успех!
      const program = programs.find((p) => p.token_address === selectedProgram);
      toast.success(
        `Referral code applied! You'll receive ${program?.referee_bonus} ${program?.symbol} tokens!`,
        { duration: 5000 }
      );

      // Очищаем форму
      setCode('');
      setSelectedProgram('');
      
      // Обновляем список использованных программ
      setAlreadyUsed([...alreadyUsed, selectedProgram]);
    } catch (err) {
      console.error('Error applying referral code:', err);
      toast.error('An error occurred while applying the code');
    } finally {
      setSubmitting(false);
    }
  };

  if (!address) {
    return null;
  }

  if (loading) {
    return null;
  }

  if (programs.length === 0) {
    return null;
  }

  const selectedProgramData = programs.find((p) => p.token_address === selectedProgram);
  const canUseCode = selectedProgram && !alreadyUsed.includes(selectedProgram);

  return (
    <Card className="border-2 border-primary/20 bg-gradient-to-br from-card to-primary/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PartyPopper className="h-5 w-5 text-primary" />
          Have a Referral Code?
        </CardTitle>
        <CardDescription>
          Enter your friend's referral code to get bonus tokens
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="program">Select Loyalty Program</Label>
            <Select value={selectedProgram} onValueChange={setSelectedProgram}>
              <SelectTrigger id="program">
                <SelectValue placeholder="Choose a program" />
              </SelectTrigger>
              <SelectContent>
                {programs.map((program) => (
                  <SelectItem
                    key={program.token_address}
                    value={program.token_address}
                    disabled={alreadyUsed.includes(program.token_address)}
                  >
                    {program.name} ({program.symbol})
                    {alreadyUsed.includes(program.token_address) && ' - Already used'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="code">Referral Code</Label>
            <Input
              id="code"
              type="text"
              placeholder="Enter 6-character code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={6}
              className="font-mono text-lg uppercase"
              disabled={!selectedProgram || !canUseCode}
            />
            <p className="text-xs text-muted-foreground">
              Ask your friend for their referral code
            </p>
          </div>

          {selectedProgramData && canUseCode && (
            <Alert className="bg-primary/10 border-primary/30">
              <Gift className="h-4 w-4 text-primary" />
              <AlertDescription className="text-foreground">
                <span className="font-semibold">Your bonus:</span> {selectedProgramData.referee_bonus}{' '}
                {selectedProgramData.symbol} tokens
              </AlertDescription>
            </Alert>
          )}

          {selectedProgram && alreadyUsed.includes(selectedProgram) && (
            <Alert className="bg-muted border-muted-foreground/20">
              <Check className="h-4 w-4 text-green-500" />
              <AlertDescription>
                You've already used a referral code for this program
              </AlertDescription>
            </Alert>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={submitting || !code || !selectedProgram || !canUseCode}
          >
            {submitting ? (
              <>Processing...</>
            ) : (
              <>
                <Gift className="h-4 w-4 mr-2" />
                Apply Referral Code
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
