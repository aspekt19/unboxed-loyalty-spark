import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Award, Save, Info, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';

interface Tier {
  id: string;
  tier_name: string;
  tier_level: number;
  min_tokens: number;
  cashback_multiplier: number;
  welcome_bonus: number;
  badge_color: string;
  perks: unknown;
}

interface ProgramTiers {
  [tokenAddress: string]: {
    programName: string;
    symbol: string;
    tiers: Tier[];
  };
}

export function TierManagement() {
  const { address } = useAccount();
  const [programTiers, setProgramTiers] = useState<ProgramTiers>({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<{ [key: string]: boolean }>({});
  const [openTiers, setOpenTiers] = useState<{ [key: string]: boolean }>({});

  const createDefaultTiers = async (tokenAddress: string) => {
    const defaultTiers = [
      {
        token_address: tokenAddress,
        tier_name: 'Bronze',
        tier_level: 1,
        min_tokens: 0,
        cashback_multiplier: 1.0,
        welcome_bonus: 10,
        badge_color: '#CD7F32',
        perks: ["Access to basic rewards", "1x cashback rate"]
      },
      {
        token_address: tokenAddress,
        tier_name: 'Silver',
        tier_level: 2,
        min_tokens: 100,
        cashback_multiplier: 1.25,
        welcome_bonus: 25,
        badge_color: '#C0C0C0',
        perks: ["Priority rewards access", "1.25x cashback rate", "Exclusive offers"]
      },
      {
        token_address: tokenAddress,
        tier_name: 'Gold',
        tier_level: 3,
        min_tokens: 500,
        cashback_multiplier: 1.5,
        welcome_bonus: 50,
        badge_color: '#FFD700',
        perks: ["Premium rewards", "1.5x cashback rate", "Birthday bonus", "Early access"]
      },
      {
        token_address: tokenAddress,
        tier_name: 'Platinum',
        tier_level: 4,
        min_tokens: 1000,
        cashback_multiplier: 2.0,
        welcome_bonus: 100,
        badge_color: '#E5E4E2',
        perks: ["VIP rewards", "2x cashback rate", "Personal manager", "Exclusive events", "Maximum benefits"]
      }
    ];

    const { error } = await supabase
      .from('customer_tiers')
      .insert(defaultTiers);

    if (error) throw error;
  };

  useEffect(() => {
    if (!address) return;

    const loadTiers = async () => {
      try {
        setLoading(true);

        const { data: programs, error: programsError } = await supabase
          .from('loyalty_programs')
          .select('token_address, name, symbol')
          .eq('merchant_address', address.toLowerCase());

        if (programsError) throw programsError;

        if (!programs || programs.length === 0) {
          setProgramTiers({});
          return;
        }

        const tiersData: ProgramTiers = {};
        const programsNeedingTiers: string[] = [];

        for (const program of programs) {
          const { data: tiers, error: tiersError } = await supabase
            .from('customer_tiers')
            .select('*')
            .eq('token_address', program.token_address)
            .order('tier_level', { ascending: true });

          if (tiersError) throw tiersError;

          tiersData[program.token_address] = {
            programName: program.name,
            symbol: program.symbol,
            tiers: tiers || [],
          };

          // Проверяем, есть ли tier'ы для программы
          if (!tiers || tiers.length === 0) {
            programsNeedingTiers.push(program.token_address);
          }
        }

        // Автоматически создаем tier'ы для программ без них
        if (programsNeedingTiers.length > 0) {
          console.log(`Creating default tiers for ${programsNeedingTiers.length} programs`);
          
          for (const tokenAddress of programsNeedingTiers) {
            try {
              await createDefaultTiers(tokenAddress);
              console.log(`Created default tiers for ${tokenAddress}`);
            } catch (err) {
              console.error(`Failed to create tiers for ${tokenAddress}:`, err);
            }
          }

          // Перезагружаем данные после создания tier'ов
          const updatedTiersData: ProgramTiers = {};
          for (const program of programs) {
            const { data: tiers } = await supabase
              .from('customer_tiers')
              .select('*')
              .eq('token_address', program.token_address)
              .order('tier_level', { ascending: true });

            updatedTiersData[program.token_address] = {
              programName: program.name,
              symbol: program.symbol,
              tiers: tiers || [],
            };
          }
          
          setProgramTiers(updatedTiersData);
          toast.success(`Automatically created tiers for ${programsNeedingTiers.length} program(s)`);
        } else {
          setProgramTiers(tiersData);
        }
      } catch (err) {
        console.error('Error loading tiers:', err);
        toast.error('Failed to load tier configuration');
      } finally {
        setLoading(false);
      }
    };

    loadTiers();
  }, [address]);

  const handleUpdateTier = async (tier: Tier) => {
    try {
      const { error } = await supabase
        .from('customer_tiers')
        .update({
          min_tokens: tier.min_tokens,
          cashback_multiplier: tier.cashback_multiplier,
          welcome_bonus: tier.welcome_bonus,
        })
        .eq('id', tier.id);

      if (error) throw error;

      toast.success(`${tier.tier_name} tier updated successfully`);
      setEditing({ ...editing, [tier.id]: false });
    } catch (err) {
      console.error('Error updating tier:', err);
      toast.error('Failed to update tier');
    }
  };

  if (loading) {
    return <Skeleton className="h-96 w-full" />;
  }

  if (Object.keys(programTiers).length === 0) {
    return (
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          No programs found. Create a loyalty program first to manage tiers.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Tier Management</h2>
        <p className="text-sm text-muted-foreground">
          Configure tier parameters for your loyalty programs
        </p>
      </div>

      <Accordion type="single" collapsible className="w-full space-y-2">
        {Object.entries(programTiers).map(([tokenAddress, program]) => (
          <AccordionItem key={tokenAddress} value={tokenAddress} className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline py-4">
              <div className="flex items-center gap-2 text-left">
                <Award className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
                <div>
                  <div className="font-semibold text-sm sm:text-base">{program.programName}</div>
                  <div className="text-xs text-muted-foreground">{program.symbol} • {program.tiers.length} tiers</div>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-3 pb-4">
              {program.tiers.map((tier) => (
                <Collapsible key={tier.id} open={openTiers[tier.id]} onOpenChange={(open) => setOpenTiers({ ...openTiers, [tier.id]: open })}>
                  <Card className="border-border/50">
                    <CardHeader className="p-3 sm:p-4">
                      <div className="flex items-center justify-between gap-2">
                        <CollapsibleTrigger className="flex items-center gap-2 hover:opacity-70 transition-opacity flex-1">
                          <Badge 
                            variant="outline" 
                            style={{ borderColor: tier.badge_color }}
                            className="text-xs shrink-0"
                          >
                            L{tier.tier_level}
                          </Badge>
                          <span className="font-semibold text-sm">{tier.tier_name}</span>
                          <ChevronDown className="h-4 w-4 ml-auto shrink-0" />
                        </CollapsibleTrigger>
                        {!editing[tier.id] ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditing({ ...editing, [tier.id]: true });
                              setOpenTiers({ ...openTiers, [tier.id]: true });
                            }}
                            className="shrink-0 h-8 text-xs"
                          >
                            Edit
                          </Button>
                        ) : (
                          <div className="flex gap-1 shrink-0">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setEditing({ ...editing, [tier.id]: false })}
                              className="h-8 text-xs"
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleUpdateTier(tier)}
                              className="h-8 text-xs"
                            >
                              <Save className="h-3 w-3 mr-1" />
                              Save
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardHeader>
                    <CollapsibleContent>
                      <CardContent className="p-3 sm:p-4 pt-0 space-y-3">
                        <div className="grid gap-3 sm:grid-cols-3">
                          <div>
                            <Label htmlFor={`min-tokens-${tier.id}`} className="text-xs">
                              Minimum Tokens
                            </Label>
                            <Input
                              id={`min-tokens-${tier.id}`}
                              type="number"
                              value={tier.min_tokens}
                              onChange={(e) => {
                                const updated = { ...programTiers };
                                const tierIndex = updated[tokenAddress].tiers.findIndex(t => t.id === tier.id);
                                updated[tokenAddress].tiers[tierIndex].min_tokens = Number(e.target.value);
                                setProgramTiers(updated);
                              }}
                              disabled={!editing[tier.id]}
                              className="mt-1 h-9 text-sm"
                            />
                          </div>

                          <div>
                            <Label htmlFor={`cashback-${tier.id}`} className="text-xs">
                              Cashback Multiplier
                            </Label>
                            <Input
                              id={`cashback-${tier.id}`}
                              type="number"
                              step="0.1"
                              value={tier.cashback_multiplier}
                              onChange={(e) => {
                                const updated = { ...programTiers };
                                const tierIndex = updated[tokenAddress].tiers.findIndex(t => t.id === tier.id);
                                updated[tokenAddress].tiers[tierIndex].cashback_multiplier = Number(e.target.value);
                                setProgramTiers(updated);
                              }}
                              disabled={!editing[tier.id]}
                              className="mt-1 h-9 text-sm"
                            />
                          </div>

                          <div>
                            <Label htmlFor={`welcome-bonus-${tier.id}`} className="text-xs">
                              Welcome Bonus
                            </Label>
                            <Input
                              id={`welcome-bonus-${tier.id}`}
                              type="number"
                              value={tier.welcome_bonus}
                              onChange={(e) => {
                                const updated = { ...programTiers };
                                const tierIndex = updated[tokenAddress].tiers.findIndex(t => t.id === tier.id);
                                updated[tokenAddress].tiers[tierIndex].welcome_bonus = Number(e.target.value);
                                setProgramTiers(updated);
                              }}
                              disabled={!editing[tier.id]}
                              className="mt-1 h-9 text-sm"
                            />
                          </div>
                        </div>
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              ))}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
