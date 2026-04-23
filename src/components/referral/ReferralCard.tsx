import { useEffect, useState, useCallback } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from '@/components/ui/carousel';
import { Users, Copy, Gift, Check, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';
import { useFarcasterHaptics } from '@/hooks/useFarcasterHaptics';
import { useActiveCustomerWallet } from '@/hooks/useActiveCustomerWallet';

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
  const { activeAddress } = useActiveCustomerWallet();
  const address = activeAddress;
  const [programs, setPrograms] = useState<ReferralProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [expandedPrograms, setExpandedPrograms] = useState<Set<string>>(new Set());
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [currentSlide, setCurrentSlide] = useState(0);
  const isMobile = useIsMobile();
  const { selectionChanged } = useFarcasterHaptics();

  useEffect(() => {
    if (!address) return;
    loadReferralPrograms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

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

  const loadReferralPrograms = async () => {
    if (!address) return;

    try {
      setLoading(true);

      const { data: vouchers } = await supabase
        .from('vouchers')
        .select('token_address, token_symbol')
        .eq('customer_address', address.toLowerCase());

      if (!vouchers || vouchers.length === 0) {
        setPrograms([]);
        return;
      }

      const tokenAddresses = [...new Set(vouchers.map((v) => v.token_address))];

      const { data: refPrograms } = await supabase
        .from('referral_programs')
        .select('*')
        .in('token_address', tokenAddresses)
        .eq('is_active', true);

      if (!refPrograms) {
        setPrograms([]);
        return;
      }

      const { data: loyaltyPrograms } = await supabase
        .from('loyalty_programs')
        .select('token_address, name, symbol')
        .in('token_address', tokenAddresses);

      const programsWithCodes = await Promise.all(
        refPrograms.map(async (prog) => {
          const lpInfo = loyaltyPrograms?.find((lp) => lp.token_address === prog.token_address);

          const { data: existingReferrals } = await supabase
            .from('referrals')
            .select('referral_code')
            .eq('token_address', prog.token_address)
            .eq('referrer_address', address.toLowerCase())
            .limit(1);

          let referralCode = existingReferrals?.[0]?.referral_code;

          if (!referralCode) {
            const { data: newCode } = await supabase.rpc('generate_referral_code', {
              p_token_address: prog.token_address,
              p_referrer_address: address.toLowerCase(),
            });

            referralCode = newCode;

            await supabase.from('referrals').insert({
              token_address: prog.token_address,
              merchant_address: prog.merchant_address,
              referrer_address: address.toLowerCase(),
              referee_address: address.toLowerCase(),
              referral_code: referralCode,
              bonus_claimed: false,
            });
          }

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
    selectionChanged();
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
    selectionChanged();
  };

  const scrollPrev = useCallback(() => {
    carouselApi?.scrollPrev();
    selectionChanged();
  }, [carouselApi, selectionChanged]);

  const scrollNext = useCallback(() => {
    carouselApi?.scrollNext();
    selectionChanged();
  }, [carouselApi, selectionChanged]);

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

  const renderProgramRow = (program: ReferralProgram) => {
    const isExpanded = expandedPrograms.has(program.token_address);
    
    return (
      <Collapsible
        key={program.token_address}
        open={isExpanded}
        onOpenChange={() => toggleProgram(program.token_address)}
      >
        <CollapsibleTrigger asChild>
          <button className="w-full text-left hover:bg-muted/50 transition-colors rounded-lg px-3 py-2.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Users className="h-4 w-4 text-primary flex-shrink-0" />
              <span className="font-medium text-sm truncate">{program.program_name}</span>
              <span className="text-xs text-muted-foreground flex-shrink-0">
                {program.referral_count} ref.
              </span>
            </div>
            <ChevronDown
              className={`h-4 w-4 text-muted-foreground transition-transform duration-200 flex-shrink-0 ${
                isExpanded ? 'rotate-180' : ''
              }`}
            />
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-3 pb-3 space-y-3">
            <div className="flex gap-2">
              <Input
                value={program.referral_code || ''}
                readOnly
                className="font-mono text-sm h-9"
              />
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 flex-shrink-0"
                onClick={() =>
                  program.referral_code &&
                  handleCopy(program.referral_code, program.token_address)
                }
              >
                {copied === program.token_address ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
            <div className="flex gap-4 text-sm">
              <div className="flex items-center gap-1">
                <Gift className="h-3.5 w-3.5 text-primary" />
                <span className="text-muted-foreground">You:</span>
                <span className="font-semibold">{program.referrer_bonus} {program.symbol}</span>
              </div>
              <div className="flex items-center gap-1">
                <Gift className="h-3.5 w-3.5 text-primary" />
                <span className="text-muted-foreground">Friend:</span>
                <span className="font-semibold">{program.referee_bonus} {program.symbol}</span>
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Referral Program</CardTitle>
          </div>
          <span className="text-xs text-muted-foreground">{programs.length} programs</span>
        </div>
        <CardDescription>Invite friends and earn rewards together</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <ScrollArea className="h-[240px] overflow-hidden">
          <div className="divide-y divide-border pr-3">
            {programs.map((program) => renderProgramRow(program))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
