import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAccount } from 'wagmi';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Users, UserPlus, Copy, Trash2, Shield, ShoppingCart, Building2 } from 'lucide-react';

type EmployeeRole = 'cashier' | 'branch_manager' | 'admin';

const roleLabels: Record<EmployeeRole, string> = {
  cashier: 'Cashier',
  branch_manager: 'Branch Manager',
  admin: 'Administrator',
};

const roleIcons: Record<EmployeeRole, typeof Shield> = {
  cashier: ShoppingCart,
  branch_manager: Building2,
  admin: Shield,
};

const roleColors: Record<EmployeeRole, string> = {
  cashier: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  branch_manager: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  admin: 'bg-red-500/10 text-red-700 dark:text-red-400',
};

export function EmployeeManagement() {
  const { address } = useAccount();
  const queryClient = useQueryClient();
  const [inviteTab, setInviteTab] = useState<string>('wallet');
  const [walletInput, setWalletInput] = useState('');
  const [selectedRole, setSelectedRole] = useState<EmployeeRole>('cashier');
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [displayName, setDisplayName] = useState('');

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['merchant-employees', address],
    queryFn: async () => {
      if (!address) return [];
      const { data, error } = await supabase
        .from('merchant_employees')
        .select('*, merchant_branches(branch_name)')
        .eq('merchant_address', address.toLowerCase())
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!address,
  });

  const { data: branches = [] } = useQuery({
    queryKey: ['merchant-branches', address],
    queryFn: async () => {
      if (!address) return [];
      const { data, error } = await supabase
        .from('merchant_branches')
        .select('id, branch_name')
        .eq('merchant_address', address.toLowerCase())
        .eq('is_active', true)
        .order('branch_name');
      if (error) throw error;
      return data;
    },
    enabled: !!address,
  });

  const { data: invites = [] } = useQuery({
    queryKey: ['merchant-invites', address],
    queryFn: async () => {
      if (!address) return [];
      const { data, error } = await supabase
        .from('merchant_invites')
        .select('*')
        .eq('merchant_address', address.toLowerCase())
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!address,
  });

  const addByWallet = useMutation({
    mutationFn: async () => {
      if (!walletInput.trim() || !address) throw new Error('Wallet address required');
      const { error } = await supabase.from('merchant_employees').insert({
        merchant_address: address.toLowerCase(),
        employee_wallet_address: walletInput.trim().toLowerCase(),
        role: selectedRole,
        branch_id: selectedBranch === 'all' ? null : selectedBranch,
        display_name: displayName.trim() || null,
        invited_by: address.toLowerCase(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Employee added');
      queryClient.invalidateQueries({ queryKey: ['merchant-employees'] });
      setWalletInput('');
      setDisplayName('');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const generateInvite = useMutation({
    mutationFn: async () => {
      if (!address) throw new Error('Not connected');
      const code = Math.random().toString(36).substring(2, 10).toUpperCase();
      const { error } = await supabase.from('merchant_invites').insert({
        merchant_address: address.toLowerCase(),
        invite_code: code,
        role: selectedRole,
        branch_id: selectedBranch === 'all' ? null : selectedBranch,
      });
      if (error) throw error;
      return code;
    },
    onSuccess: (code) => {
      toast.success(`Invite code: ${code}`, { duration: 10000 });
      navigator.clipboard.writeText(code);
      queryClient.invalidateQueries({ queryKey: ['merchant-invites'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeEmployee = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('merchant_employees').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Employee removed');
      queryClient.invalidateQueries({ queryKey: ['merchant-employees'] });
    },
  });

  const cancelInvite = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('merchant_invites').update({ status: 'cancelled' }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['merchant-invites'] });
      toast.success('Invite cancelled');
    },
  });

  const updateEmployeeRole = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: EmployeeRole }) => {
      const { error } = await supabase.from('merchant_employees').update({ role }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['merchant-employees'] });
      toast.success('Role updated');
    },
  });

  if (!address) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          Team Members
        </CardTitle>
        <CardDescription>
          Add employees who can issue loyalty points on your behalf
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Invite form */}
        <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <UserPlus className="h-4 w-4" /> Add Employee
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as EmployeeRole)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cashier">Cashier — Issue points only</SelectItem>
                  <SelectItem value="branch_manager">Manager — Points + branch analytics</SelectItem>
                  <SelectItem value="admin">Admin — Full access to all branches</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Branch (optional)</Label>
              <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                <SelectTrigger><SelectValue placeholder="All branches" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All branches</SelectItem>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.branch_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Tabs value={inviteTab} onValueChange={setInviteTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="wallet">By Wallet</TabsTrigger>
              <TabsTrigger value="code">Invite Code</TabsTrigger>
            </TabsList>
            <TabsContent value="wallet" className="space-y-3 pt-2">
              <div className="space-y-2">
                <Label>Employee Wallet Address</Label>
                <Input
                  placeholder="0x..."
                  value={walletInput}
                  onChange={(e) => setWalletInput(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Display Name (optional)</Label>
                <Input
                  placeholder="John"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>
              <Button
                size="sm"
                onClick={() => addByWallet.mutate()}
                disabled={!walletInput.trim() || addByWallet.isPending}
              >
                Add Employee
              </Button>
            </TabsContent>
            <TabsContent value="code" className="space-y-3 pt-2">
              <p className="text-xs text-muted-foreground">
                Generate a one-time invite code. Share it with the employee — they'll enter it on their device to join.
              </p>
              <Button
                size="sm"
                onClick={() => generateInvite.mutate()}
                disabled={generateInvite.isPending}
              >
                Generate Invite Code
              </Button>
              {invites.length > 0 && (
                <div className="space-y-2 mt-2">
                  <Label className="text-xs">Pending Invites</Label>
                  {invites.map((inv) => (
                    <div key={inv.id} className="flex items-center justify-between bg-background border rounded px-3 py-2">
                      <div className="flex items-center gap-2">
                        <code className="text-sm font-mono">{inv.invite_code}</code>
                        <Badge variant="outline" className="text-[10px]">{inv.role}</Badge>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            navigator.clipboard.writeText(inv.invite_code || '');
                            toast.success('Code copied');
                          }}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => cancelInvite.mutate(inv.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Employee list */}
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : employees.length === 0 ? (
          <Alert>
            <AlertDescription>
              No team members yet. Add cashiers or managers to help run your loyalty program.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-2">
            {employees.map((emp) => {
              const RoleIcon = roleIcons[emp.role as EmployeeRole] || ShoppingCart;
              return (
                <div key={emp.id} className="flex items-center justify-between border rounded-lg p-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm truncate">
                        {emp.display_name || `${emp.employee_wallet_address.slice(0, 6)}...${emp.employee_wallet_address.slice(-4)}`}
                      </span>
                      <Badge className={`text-[10px] ${roleColors[emp.role as EmployeeRole] || ''}`}>
                        <RoleIcon className="h-3 w-3 mr-1" />
                        {roleLabels[emp.role as EmployeeRole] || emp.role}
                      </Badge>
                      {!emp.is_active && (
                        <Badge variant="secondary" className="text-[10px]">Inactive</Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                      <code className="text-[10px]">
                        {emp.employee_wallet_address.slice(0, 10)}...{emp.employee_wallet_address.slice(-6)}
                      </code>
                      {(emp as any).merchant_branches?.branch_name && (
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          {(emp as any).merchant_branches.branch_name}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Select
                      value={emp.role}
                      onValueChange={(v) => updateEmployeeRole.mutate({ id: emp.id, role: v as EmployeeRole })}
                    >
                      <SelectTrigger className="h-8 w-[120px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cashier">Cashier</SelectItem>
                        <SelectItem value="branch_manager">Manager</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => {
                        if (confirm('Remove this employee?')) removeEmployee.mutate(emp.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
