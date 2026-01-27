import { useEffect, useState, useCallback } from 'react';
import { useAccount } from 'wagmi';
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
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [currentSlide, setCurrentSlide] = useState(0);
  const isMobile = useIsMobile();
  const { selectionChanged } = useFarcasterHaptics();

  useEffect(() => {
    if (!address) return;
    loadReferralPrograms();
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

  const renderProgramCard = (program: ReferralProgram) => {
    const isExpanded = expandedPrograms.has(program.token_address);
    
    return (
      <Collapsible
        key={program.token_address}
        open={isExpanded}
        onOpenChange={() => toggleProgram(program.token_address)}
      >
        <Card className="border-2 h-full">
          <CardHeader className="pb-2">
            <CollapsibleTrigger asChild>
              <button className="w-full text-left hover:opacity-80 transition-opacity">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Users className="h-5 w-5 text-primary flex-shrink-0" />
                    <CardTitle className="text-base sm:text-lg truncate">
                      {program.program_name}
                    </CardTitle>
                  </div>
                  <ChevronDown
                    className={`h-5 w-5 text-muted-foreground transition-transform duration-200 flex-shrink-0 ${
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
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Referral Program</h2>
          <p className="text-muted-foreground">Invite friends and earn rewards together</p>
        </div>
        {isMobile && programs.length > 1 && (
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <span>{currentSlide + 1}/{programs.length}</span>
          </div>
        )}
      </div>

      {isMobile && programs.length > 1 ? (
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
              {programs.map((program) => (
                <CarouselItem key={program.token_address} className="pl-2 basis-[90%]">
                  {renderProgramCard(program)}
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>
          
          {programs.length > 1 && (
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
                {programs.map((_, index) => (
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
                disabled={currentSlide === programs.length - 1}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {programs.map((program) => renderProgramCard(program))}
        </div>
      )}
    </div>
  );
}
