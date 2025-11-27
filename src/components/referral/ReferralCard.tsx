import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Users, Copy, Gift, Check, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';

interface ReferralProgram {
  token_address: string;
  program_name: string;
  symbol: string;
  referrer_bonus: number;
  referee_bonus: number;
  is_active: boolean;
  referral_code: string | null;
  referral_count: number;
}

export function ReferralCard() {
  const { address } = useAccount();
  const [programs, setPrograms] = useState<ReferralProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [expandedPrograms, setExpandedPrograms] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!address) return;

    loadReferralPrograms();
  }, [address]);

  const loadReferralPrograms = async () => {
    if (!address) return;

    try {
      setLoading(true);

      // Получаем программы, в которых у пользователя есть токены
      const { data: vouchers } = await supabase
        .from('vouchers')
        .select('token_address, token_symbol')
        .eq('customer_address', address.toLowerCase());

      if (!vouchers || vouchers.length === 0) {
        setPrograms([]);
        return;
      }

      const tokenAddresses = [...new Set(vouchers.map((v) => v.token_address))];

      // Получаем реферальные программы
      const { data: refPrograms } = await supabase
        .from('referral_programs')
        .select('*')
        .in('token_address', tokenAddresses)
        .eq('is_active', true);

      if (!refPrograms) {
        setPrograms([]);
        return;
      }

      // Получаем имена программ
      const { data: loyaltyPrograms } = await supabase
        .from('loyalty_programs')
        .select('token_address, name, symbol')
        .in('token_address', tokenAddresses);

      // Получаем или генерируем реферальные коды
      const programsWithCodes = await Promise.all(
        refPrograms.map(async (prog) => {
          const lpInfo = loyaltyPrograms?.find((lp) => lp.token_address === prog.token_address);

          // Проверяем, есть ли уже реферальный код
          const { data: existingReferrals } = await supabase
            .from('referrals')
            .select('referral_code')
            .eq('token_address', prog.token_address)
            .eq('referrer_address', address.toLowerCase())
            .limit(1);

          let referralCode = existingReferrals?.[0]?.referral_code;

          // Если кода нет, генерируем новый
          if (!referralCode) {
            const { data: newCode } = await supabase.rpc('generate_referral_code', {
              p_token_address: prog.token_address,
              p_referrer_address: address.toLowerCase(),
            });

            referralCode = newCode;

            // Создаём запись с новым кодом (как шаблон для будущих рефералов)
            await supabase.from('referrals').insert({
              token_address: prog.token_address,
              merchant_address: prog.merchant_address,
              referrer_address: address.toLowerCase(),
              referee_address: address.toLowerCase(), // Временно, не будет использоваться
              referral_code: referralCode,
              bonus_claimed: false,
            });
          }

          // Подсчитываем количество рефералов
          const { count } = await supabase
            .from('referrals')
            .select('*', { count: 'exact', head: true })
            .eq('token_address', prog.token_address)
            .eq('referrer_address', address.toLowerCase())
            .neq('referee_address', address.toLowerCase());

          return {
            token_address: prog.token_address,
            program_name: lpInfo?.name || 'Unknown Program',
            symbol: lpInfo?.symbol || '',
            referrer_bonus: Number(prog.referrer_bonus),
            referee_bonus: Number(prog.referee_bonus),
            is_active: prog.is_active,
            referral_code: referralCode,
            referral_count: count || 0,
          };
        })
      );

      setPrograms(programsWithCodes);
    } catch (err) {
      console.error('Error loading referral programs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (code: string, tokenAddress: string) => {
    navigator.clipboard.writeText(code);
    setCopied(tokenAddress);
    toast.success('Referral code copied!');
    setTimeout(() => setCopied(null), 2000);
  };

  const toggleProgram = (tokenAddress: string) => {
    setExpandedPrograms((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(tokenAddress)) {
        newSet.delete(tokenAddress);
      } else {
        newSet.add(tokenAddress);
      }
      return newSet;
    });
  };

  if (loading) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (programs.length === 0) {
    return (
      <Alert>
        <Users className="h-4 w-4" />
        <AlertDescription>
          Join a loyalty program to get your referral code and earn rewards!
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Referral Program</h2>
        <p className="text-muted-foreground">Invite friends and earn rewards together</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {programs.map((program) => {
          const isExpanded = expandedPrograms.has(program.token_address);
          
          return (
            <Collapsible
              key={program.token_address}
              open={isExpanded}
              onOpenChange={() => toggleProgram(program.token_address)}
            >
              <Card className="border-2">
                <CardHeader>
                  <CollapsibleTrigger asChild>
                    <button className="w-full text-left hover:opacity-80 transition-opacity">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Users className="h-5 w-5 text-primary" />
                          <CardTitle className="text-base sm:text-lg">
                            {program.program_name}
                          </CardTitle>
                        </div>
                        <ChevronDown
                          className={`h-5 w-5 text-muted-foreground transition-transform duration-200 ${
                            isExpanded ? 'transform rotate-180' : ''
                          }`}
                        />
                      </div>
                    </button>
                  </CollapsibleTrigger>
                  <CardDescription>
                    {program.referral_count} referral{program.referral_count !== 1 ? 's' : ''}
                  </CardDescription>
                </CardHeader>

                <CollapsibleContent>
                  <CardContent className="space-y-4 pt-0">
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Your Referral Code</p>
                      <div className="flex gap-2">
                        <Input
                          value={program.referral_code || ''}
                          readOnly
                          className="font-mono text-lg"
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() =>
                            program.referral_code &&
                            handleCopy(program.referral_code, program.token_address)
                          }
                        >
                          {copied === program.token_address ? (
                            <Check className="h-4 w-4" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Your Bonus</p>
                        <div className="flex items-center gap-1">
                          <Gift className="h-4 w-4 text-primary" />
                          <p className="font-semibold">
                            {program.referrer_bonus} {program.symbol}
                          </p>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Friend Bonus</p>
                        <div className="flex items-center gap-1">
                          <Gift className="h-4 w-4 text-primary" />
                          <p className="font-semibold">
                            {program.referee_bonus} {program.symbol}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          );
        })}
      </div>
    </div>
  );
}
