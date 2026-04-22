import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Ban, ShieldCheck, Trash2, History, Search, Loader2, Users, Store } from 'lucide-react';
import { format } from 'date-fns';

type Role = 'merchant' | 'customer';

interface UserRow {
  wallet_address: string;
  email: string | null;
  is_banned: boolean;
  banned_at: string | null;
  ban_reason: string | null;
  created_at: string;
  business_name?: string | null;
  category?: string | null;
  first_name?: string | null;
  last_name?: string | null;
}

interface ModerationLogRow {
  id: string;
  action: string;
  reason: string | null;
  performed_by_wallet: string;
  created_at: string;
  target_role: string;
}

const shortWallet = (addr: string) =>
  addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : '';

function UserTable({ role }: { role: Role }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [banDialog, setBanDialog] = useState<{ user: UserRow; reason: string } | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<UserRow | null>(null);
  const [historyUser, setHistoryUser] = useState<UserRow | null>(null);

  const queryKey = ['admin-users', role];

  const { data: users = [], isLoading } = useQuery({
    queryKey,
    queryFn: async (): Promise<UserRow[]> => {
      const fnName = role === 'merchant' ? 'admin_list_merchants' : 'admin_list_customers';
      const { data, error } = await supabase.rpc(fnName);
      if (error) throw error;
      return (data ?? []) as UserRow[];
    },
  });

  const banMutation = useMutation({
    mutationFn: async ({ wallet, reason }: { wallet: string; reason: string }) => {
      const { data, error } = await supabase.rpc('admin_ban_user', {
        p_wallet_address: wallet,
        p_target_role: role,
        p_reason: reason || null,
      });
      if (error) throw error;
      const result = data as { ok: boolean; error?: string };
      if (!result?.ok) throw new Error(result?.error ?? 'Failed');
    },
    onSuccess: () => {
      toast.success('User banned');
      queryClient.invalidateQueries({ queryKey });
      setBanDialog(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const unbanMutation = useMutation({
    mutationFn: async (wallet: string) => {
      const { data, error } = await supabase.rpc('admin_unban_user', {
        p_wallet_address: wallet,
        p_target_role: role,
        p_reason: null,
      });
      if (error) throw error;
      const result = data as { ok: boolean; error?: string };
      if (!result?.ok) throw new Error(result?.error ?? 'Failed');
    },
    onSuccess: () => {
      toast.success('User unbanned');
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (wallet: string) => {
      const { data, error } = await supabase.rpc('admin_delete_user', {
        p_wallet_address: wallet,
        p_target_role: role,
        p_reason: 'Admin deletion',
      });
      if (error) throw error;
      const result = data as { ok: boolean; error?: string };
      if (!result?.ok) throw new Error(result?.error ?? 'Failed');
    },
    onSuccess: () => {
      toast.success('User deleted');
      queryClient.invalidateQueries({ queryKey });
      setDeleteDialog(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = users.filter((u) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      u.wallet_address.toLowerCase().includes(s) ||
      (u.email ?? '').toLowerCase().includes(s) ||
      (u.business_name ?? '').toLowerCase().includes(s) ||
      (u.first_name ?? '').toLowerCase().includes(s) ||
      (u.last_name ?? '').toLowerCase().includes(s)
    );
  });

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by wallet, email, name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-8">No users found</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((u) => (
            <Card key={u.wallet_address} className={u.is_banned ? 'border-destructive/50' : ''}>
              <CardContent className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium truncate">
                      {role === 'merchant'
                        ? (u.business_name ?? shortWallet(u.wallet_address))
                        : ([u.first_name, u.last_name].filter(Boolean).join(' ') ||
                            shortWallet(u.wallet_address))}
                    </span>
                    {u.is_banned && (
                      <Badge variant="destructive" className="text-[10px]">Banned</Badge>
                    )}
                    {role === 'merchant' && u.category && (
                      <Badge variant="outline" className="text-[10px]">{u.category}</Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                    <div className="font-mono truncate">{u.wallet_address}</div>
                    {u.email && <div className="truncate">{u.email}</div>}
                    {u.is_banned && u.ban_reason && (
                      <div className="text-destructive">Reason: {u.ban_reason}</div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setHistoryUser(u)}
                    title="History"
                  >
                    <History className="h-4 w-4" />
                  </Button>
                  {u.is_banned ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => unbanMutation.mutate(u.wallet_address)}
                      disabled={unbanMutation.isPending}
                    >
                      <ShieldCheck className="h-4 w-4 mr-1" /> Unban
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setBanDialog({ user: u, reason: '' })}
                    >
                      <Ban className="h-4 w-4 mr-1" /> Ban
                    </Button>
                  )}
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setDeleteDialog(u)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Ban dialog */}
      <Dialog open={!!banDialog} onOpenChange={(o) => !o && setBanDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ban user</DialogTitle>
            <DialogDescription>
              {banDialog && shortWallet(banDialog.user.wallet_address)} will not be able to use the platform.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Reason for ban (optional)"
            value={banDialog?.reason ?? ''}
            onChange={(e) =>
              setBanDialog((prev) => (prev ? { ...prev, reason: e.target.value } : prev))
            }
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setBanDialog(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() =>
                banDialog &&
                banMutation.mutate({
                  wallet: banDialog.user.wallet_address,
                  reason: banDialog.reason,
                })
              }
              disabled={banMutation.isPending}
            >
              {banMutation.isPending && <Loader2 className="h-3 w-3 mr-2 animate-spin" />}
              Confirm Ban
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteDialog} onOpenChange={(o) => !o && setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete user permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              This deletes the {role} profile and related data. This action cannot be undone.
              On-chain data and historic logs will be preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteDialog && deleteMutation.mutate(deleteDialog.wallet_address)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending && <Loader2 className="h-3 w-3 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* History */}
      <Dialog open={!!historyUser} onOpenChange={(o) => !o && setHistoryUser(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Moderation history</DialogTitle>
            <DialogDescription className="font-mono text-xs break-all">
              {historyUser?.wallet_address}
            </DialogDescription>
          </DialogHeader>
          {historyUser && <ModerationHistory wallet={historyUser.wallet_address} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ModerationHistory({ wallet }: { wallet: string }) {
  const { data = [], isLoading } = useQuery({
    queryKey: ['user-moderation-history', wallet],
    queryFn: async (): Promise<ModerationLogRow[]> => {
      const { data, error } = await supabase.rpc('admin_user_moderation_history', {
        p_wallet: wallet,
      });
      if (error) throw error;
      return (data ?? []) as ModerationLogRow[];
    },
  });

  if (isLoading) {
    return <Loader2 className="h-5 w-5 animate-spin mx-auto my-4" />;
  }
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-4">No history</p>;
  }
  return (
    <div className="space-y-2 max-h-80 overflow-y-auto">
      {data.map((row) => (
        <div key={row.id} className="border rounded-md p-2 text-xs space-y-1">
          <div className="flex items-center justify-between">
            <Badge
              variant={
                row.action === 'ban' || row.action === 'delete' ? 'destructive' : 'default'
              }
              className="text-[10px]"
            >
              {row.action}
            </Badge>
            <span className="text-muted-foreground">
              {format(new Date(row.created_at), 'MMM d, yyyy HH:mm')}
            </span>
          </div>
          {row.reason && <div>Reason: {row.reason}</div>}
          <div className="text-muted-foreground font-mono">
            By: {shortWallet(row.performed_by_wallet)}
          </div>
        </div>
      ))}
    </div>
  );
}

export function UserManagement() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>User Management</CardTitle>
        <CardDescription>
          Ban, unban or delete merchants and customers who violate platform rules.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="merchants" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 max-w-sm">
            <TabsTrigger value="merchants" className="gap-1.5">
              <Store className="h-3.5 w-3.5" /> Merchants
            </TabsTrigger>
            <TabsTrigger value="customers" className="gap-1.5">
              <Users className="h-3.5 w-3.5" /> Customers
            </TabsTrigger>
          </TabsList>
          <TabsContent value="merchants">
            <UserTable role="merchant" />
          </TabsContent>
          <TabsContent value="customers">
            <UserTable role="customer" />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
