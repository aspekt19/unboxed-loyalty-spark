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
import { toast } from 'sonner';
import { Building2, Plus, MapPin, Phone, Trash2, Edit2, Check, X } from 'lucide-react';

export function BranchManagement() {
  const { address } = useAccount();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ branch_name: '', branch_address: '', phone: '' });

  const { data: branches = [], isLoading } = useQuery({
    queryKey: ['merchant-branches', address],
    queryFn: async () => {
      if (!address) return [];
      const { data, error } = await supabase
        .from('merchant_branches')
        .select('*')
        .eq('merchant_address', address.toLowerCase())
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!address,
  });

  const createBranch = useMutation({
    mutationFn: async (values: typeof form) => {
      const { error } = await supabase.from('merchant_branches').insert({
        merchant_address: address!.toLowerCase(),
        branch_name: values.branch_name,
        branch_address: values.branch_address || null,
        phone: values.phone || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Branch created');
      queryClient.invalidateQueries({ queryKey: ['merchant-branches'] });
      setShowForm(false);
      setForm({ branch_name: '', branch_address: '', phone: '' });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateBranch = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: typeof form }) => {
      const { error } = await supabase.from('merchant_branches').update({
        branch_name: values.branch_name,
        branch_address: values.branch_address || null,
        phone: values.phone || null,
      }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Branch updated');
      queryClient.invalidateQueries({ queryKey: ['merchant-branches'] });
      setEditingId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleBranch = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('merchant_branches').update({ is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['merchant-branches'] });
    },
  });

  const deleteBranch = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('merchant_branches').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Branch deleted');
      queryClient.invalidateQueries({ queryKey: ['merchant-branches'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!address) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Branches
            </CardTitle>
            <CardDescription>Manage your store locations</CardDescription>
          </div>
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            <Plus className="h-4 w-4 mr-1" /> Add Branch
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showForm && (
          <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
            <div className="space-y-2">
              <Label>Branch Name *</Label>
              <Input
                placeholder="Main Store"
                value={form.branch_name}
                onChange={(e) => setForm({ ...form, branch_name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Address</Label>
                <Input
                  placeholder="123 Main St"
                  value={form.branch_address}
                  onChange={(e) => setForm({ ...form, branch_address: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  placeholder="+1 234 567 8900"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => createBranch.mutate(form)}
                disabled={!form.branch_name.trim() || createBranch.isPending}
              >
                Create
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : branches.length === 0 ? (
          <Alert>
            <AlertDescription>No branches yet. Add your first branch to start organizing your team.</AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-2">
            {branches.map((branch) => {
              const isEditing = editingId === branch.id;
              return (
                <div key={branch.id} className="flex items-center justify-between border rounded-lg p-3">
                  {isEditing ? (
                    <div className="flex-1 space-y-2 mr-2">
                      <Input
                        defaultValue={branch.branch_name}
                        id={`edit-name-${branch.id}`}
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            const nameEl = document.getElementById(`edit-name-${branch.id}`) as HTMLInputElement;
                            updateBranch.mutate({
                              id: branch.id,
                              values: {
                                branch_name: nameEl.value,
                                branch_address: branch.branch_address || '',
                                phone: branch.phone || '',
                              },
                            });
                          }}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">{branch.branch_name}</span>
                          <Badge variant={branch.is_active ? 'default' : 'secondary'} className="text-[10px]">
                            {branch.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          {branch.branch_address && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" /> {branch.branch_address}
                            </span>
                          )}
                          {branch.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" /> {branch.phone}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(branch.id)}>
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => toggleBranch.mutate({ id: branch.id, is_active: !branch.is_active })}
                        >
                          {branch.is_active ? 'Disable' : 'Enable'}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => {
                            if (confirm('Delete this branch?')) deleteBranch.mutate(branch.id);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
