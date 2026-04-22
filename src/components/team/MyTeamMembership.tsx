import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAccount } from 'wagmi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield, ShoppingCart, Building2, Users } from 'lucide-react';

const roleLabels: Record<string, string> = {
  cashier: 'Cashier',
  branch_manager: 'Branch Manager',
  admin: 'Administrator',
};

const roleIcons: Record<string, typeof Shield> = {
  cashier: ShoppingCart,
  branch_manager: Building2,
  admin: Shield,
};

const roleColors: Record<string, string> = {
  cashier: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  branch_manager: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  admin: 'bg-red-500/10 text-red-700 dark:text-red-400',
};

export function MyTeamMembership() {
  const { address } = useAccount();

  const { data: memberships = [] } = useQuery({
    queryKey: ['my-team-memberships', address],
    queryFn: async () => {
      if (!address) return [];
      const { data, error } = await supabase
        .from('merchant_employees')
        .select('*, merchant_branches(branch_name)')
        .eq('employee_wallet_address', address.toLowerCase())
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      if (error) throw error;

      // Enrich with merchant profile info
      type EmployeeRow = {
        id: string;
        merchant_address: string;
        role: string;
        merchant_branches?: { branch_name?: string } | null;
      };
      const rows = (data ?? []) as EmployeeRow[];
      const merchantAddresses = [...new Set(rows.map((d) => d.merchant_address))];
      const { data: profiles } = await supabase
        .from('merchant_profiles')
        .select('merchant_address, business_name')
        .in('merchant_address', merchantAddresses);

      const profileMap = new Map(
        ((profiles ?? []) as Array<{ merchant_address: string; business_name: string }>).map(
          (p) => [p.merchant_address, p.business_name],
        ),
      );

      return rows.map((d) => ({
        ...d,
        business_name: profileMap.get(d.merchant_address) || `${d.merchant_address.slice(0, 6)}...${d.merchant_address.slice(-4)}`,
      }));
    },
    enabled: !!address,
  });

  if (!address || memberships.length === 0) return null;

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          Your Team Memberships
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {memberships.map((m) => {
          const RoleIcon = roleIcons[m.role] || ShoppingCart;
          const branchName = m.merchant_branches?.branch_name;
          return (
            <div key={m.id} className="flex items-center justify-between border rounded-lg p-3 bg-background">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm">{m.business_name}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <Badge className={`text-[10px] ${roleColors[m.role] || ''}`}>
                    <RoleIcon className="h-3 w-3 mr-1" />
                    {roleLabels[m.role] || m.role}
                  </Badge>
                  {branchName && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Building2 className="h-3 w-3" />
                      {branchName}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
