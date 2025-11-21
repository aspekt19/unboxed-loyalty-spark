import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { UserPlus, Save, Info } from 'lucide-react';
import { toast } from 'sonner';

interface ReferralProgram {
  id: string;
  token_address: string;
  program_name: string;
  symbol: string;
  referrer_bonus: number;
  referee_bonus: number;
  is_active: boolean;
  min_purchase_required: number;
}

export function ReferralManagement() {
  const { address } = useAccount();
  const [programs, setPrograms] = useState<ReferralProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (!address) return;

    loadPrograms();
  }, [address]);

  const loadPrograms = async () => {
    if (!address) return;

    try {
      setLoading(true);

      // Получаем программы мерчанта
      const { data: loyaltyPrograms } = await supabase
        .from('loyalty_programs')
        .select('token_address, name, symbol')
        .eq('merchant_address', address.toLowerCase());

      if (!loyaltyPrograms || loyaltyPrograms.length === 0) {
        setPrograms([]);
        return;
      }

      // Получаем реферальные программы
      const { data: refPrograms } = await supabase
        .from('referral_programs')
        .select('*')
        .in(
          'token_address',
          loyaltyPrograms.map((lp) => lp.token_address)
        );

      const programsWithNames = (refPrograms || []).map((rp) => {
        const lp = loyaltyPrograms.find((l) => l.token_address === rp.token_address);
        return {
          id: rp.id,
          token_address: rp.token_address,
          program_name: lp?.name || 'Unknown',
          symbol: lp?.symbol || '',
          referrer_bonus: Number(rp.referrer_bonus),
          referee_bonus: Number(rp.referee_bonus),
          is_active: rp.is_active,
          min_purchase_required: Number(rp.min_purchase_required),
        };
      });

      setPrograms(programsWithNames);
    } catch (err) {
      console.error('Error loading referral programs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (program: ReferralProgram) => {
    setSaving(program.id);
    try {
      const { error } = await supabase
        .from('referral_programs')
        .update({
          referrer_bonus: program.referrer_bonus,
          referee_bonus: program.referee_bonus,
          is_active: program.is_active,
          min_purchase_required: program.min_purchase_required,
        })
        .eq('id', program.id);

      if (error) throw error;

      toast.success('Referral program updated');
    } catch (err) {
      console.error('Error updating referral program:', err);
      toast.error('Failed to update program');
    } finally {
      setSaving(null);
    }
  };

  const updateProgram = (id: string, updates: Partial<ReferralProgram>) => {
    setPrograms((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
    );
  };

  if (loading) {
    return <Skeleton className="h-96 w-full" />;
  }

  if (programs.length === 0) {
    return (
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Create a loyalty program first to set up referrals.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Referral Settings</h2>
        <p className="text-muted-foreground">
          Configure referral bonuses for your loyalty programs
        </p>
      </div>

      {programs.map((program) => (
        <Card key={program.id}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5" />
                  {program.program_name}
                </CardTitle>
                <CardDescription>{program.symbol} Referral Program</CardDescription>
              </div>
              <Switch
                checked={program.is_active}
                onCheckedChange={(checked) =>
                  updateProgram(program.id, { is_active: checked })
                }
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor={`referrer-${program.id}`}>
                  Referrer Bonus (tokens)
                </Label>
                <Input
                  id={`referrer-${program.id}`}
                  type="number"
                  min="0"
                  value={program.referrer_bonus}
                  onChange={(e) =>
                    updateProgram(program.id, {
                      referrer_bonus: Number(e.target.value),
                    })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Tokens the referrer earns per successful referral
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor={`referee-${program.id}`}>
                  Referee Bonus (tokens)
                </Label>
                <Input
                  id={`referee-${program.id}`}
                  type="number"
                  min="0"
                  value={program.referee_bonus}
                  onChange={(e) =>
                    updateProgram(program.id, {
                      referee_bonus: Number(e.target.value),
                    })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Welcome bonus for new referred customers
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor={`min-purchase-${program.id}`}>
                Minimum Purchase Required (optional)
              </Label>
              <Input
                id={`min-purchase-${program.id}`}
                type="number"
                min="0"
                value={program.min_purchase_required}
                onChange={(e) =>
                  updateProgram(program.id, {
                    min_purchase_required: Number(e.target.value),
                  })
                }
              />
              <p className="text-xs text-muted-foreground">
                Minimum tokens the referee must earn before bonuses are awarded
              </p>
            </div>

            <Button
              onClick={() => handleUpdate(program)}
              disabled={saving === program.id}
              className="w-full"
            >
              <Save className="h-4 w-4 mr-2" />
              {saving === program.id ? 'Saving...' : 'Save Changes'}
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
