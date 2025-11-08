import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Award, Save, Info } from 'lucide-react';
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

  useEffect(() => {
    if (!address) return;

    const loadTiers = async () => {
      try {
        setLoading(true);

        // Получаем программы мерчанта
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

        // Загружаем уровни для каждой программы
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
        }

        setProgramTiers(tiersData);
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
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Tier Management</h2>
        <p className="text-muted-foreground">
          Customize loyalty tiers for your programs
        </p>
      </div>

      {Object.entries(programTiers).map(([tokenAddress, program]) => (
        <Card key={tokenAddress}>
          <CardHeader>
            <CardTitle>
              {program.programName} ({program.symbol})
            </CardTitle>
            <CardDescription>
              Configure tier thresholds and benefits
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {program.tiers.map((tier) => (
                <div
                  key={tier.id}
                  className="p-4 border rounded-lg space-y-4"
                  style={{ borderColor: tier.badge_color + '40' }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Award
                        className="h-6 w-6"
                        style={{ color: tier.badge_color }}
                      />
                      <div>
                        <h3 className="font-semibold">{tier.tier_name}</h3>
                        <p className="text-sm text-muted-foreground">
                          Level {tier.tier_level}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant="secondary"
                      style={{
                        backgroundColor: tier.badge_color + '20',
                        color: tier.badge_color,
                      }}
                    >
                      {tier.cashback_multiplier}x
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor={`min-tokens-${tier.id}`}>
                        Minimum Tokens
                      </Label>
                      <Input
                        id={`min-tokens-${tier.id}`}
                        type="number"
                        min="0"
                        value={tier.min_tokens}
                        disabled={!editing[tier.id]}
                        onChange={(e) => {
                          const newTiers = { ...programTiers };
                          const tierIndex = newTiers[tokenAddress].tiers.findIndex(
                            (t) => t.id === tier.id
                          );
                          if (tierIndex !== -1) {
                            newTiers[tokenAddress].tiers[tierIndex].min_tokens =
                              Number(e.target.value);
                            setProgramTiers(newTiers);
                          }
                        }}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`multiplier-${tier.id}`}>
                        Cashback Multiplier
                      </Label>
                      <Input
                        id={`multiplier-${tier.id}`}
                        type="number"
                        min="0"
                        step="0.1"
                        value={tier.cashback_multiplier}
                        disabled={!editing[tier.id]}
                        onChange={(e) => {
                          const newTiers = { ...programTiers };
                          const tierIndex = newTiers[tokenAddress].tiers.findIndex(
                            (t) => t.id === tier.id
                          );
                          if (tierIndex !== -1) {
                            newTiers[tokenAddress].tiers[
                              tierIndex
                            ].cashback_multiplier = Number(e.target.value);
                            setProgramTiers(newTiers);
                          }
                        }}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`welcome-${tier.id}`}>Welcome Bonus</Label>
                      <Input
                        id={`welcome-${tier.id}`}
                        type="number"
                        min="0"
                        value={tier.welcome_bonus}
                        disabled={!editing[tier.id]}
                        onChange={(e) => {
                          const newTiers = { ...programTiers };
                          const tierIndex = newTiers[tokenAddress].tiers.findIndex(
                            (t) => t.id === tier.id
                          );
                          if (tierIndex !== -1) {
                            newTiers[tokenAddress].tiers[tierIndex].welcome_bonus =
                              Number(e.target.value);
                            setProgramTiers(newTiers);
                          }
                        }}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    {editing[tier.id] ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditing({ ...editing, [tier.id]: false });
                            // Reload to reset changes
                            window.location.reload();
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleUpdateTier(tier)}
                        >
                          <Save className="h-4 w-4 mr-2" />
                          Save
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setEditing({ ...editing, [tier.id]: true })
                        }
                      >
                        Edit
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
