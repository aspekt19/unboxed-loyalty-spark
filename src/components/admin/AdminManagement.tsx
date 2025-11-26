import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Shield, Trash2, UserPlus, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';

export const AdminManagement = () => {
  const [searchWallet, setSearchWallet] = useState('');
  const queryClient = useQueryClient();

  // Получаем список всех админов
  const { data: admins, isLoading } = useQuery({
    queryKey: ['admins'],
    queryFn: async () => {
      // Сначала получаем все записи из user_roles с ролью admin
      const { data: userRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('*')
        .eq('role', 'admin');

      if (rolesError) throw rolesError;

      // Затем получаем профили для этих пользователей
      const userIds = userRoles?.map(r => r.user_id) || [];
      
      if (userIds.length === 0) return [];

      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, wallet_address')
        .in('user_id', userIds);

      if (profilesError) throw profilesError;

      // Объединяем данные
      return userRoles.map(role => ({
        ...role,
        profile: profiles?.find(p => p.user_id === role.user_id)
      }));
    },
  });

  // Поиск пользователя по wallet адресу
  const { data: searchedUser, refetch: searchUser } = useQuery({
    queryKey: ['user-search', searchWallet],
    queryFn: async () => {
      if (!searchWallet || searchWallet.length < 10) return null;

      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, wallet_address')
        .ilike('wallet_address', `%${searchWallet}%`)
        .limit(1)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // No rows found
        throw error;
      }
      return data;
    },
    enabled: false,
  });

  // Добавление админа
  const addAdmin = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from('user_roles')
        .insert({
          user_id: userId,
          role: 'admin',
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Админ успешно добавлен!');
      queryClient.invalidateQueries({ queryKey: ['admins'] });
      setSearchWallet('');
    },
    onError: (error: any) => {
      console.error('Error adding admin:', error);
      if (error.code === '23505') {
        toast.error('Этот пользователь уже является админом');
      } else {
        toast.error('Ошибка при добавлении админа');
      }
    },
  });

  // Удаление админа
  const removeAdmin = useMutation({
    mutationFn: async (userId: string) => {
      // Проверяем, что это не последний админ
      const { count } = await supabase
        .from('user_roles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'admin');

      if (count && count <= 1) {
        throw new Error('Нельзя удалить последнего админа');
      }

      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role', 'admin');

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Админ успешно удалён');
      queryClient.invalidateQueries({ queryKey: ['admins'] });
    },
    onError: (error: any) => {
      console.error('Error removing admin:', error);
      toast.error(error.message || 'Ошибка при удалении админа');
    },
  });

  const handleSearch = () => {
    if (searchWallet.length < 10) {
      toast.error('Введите корректный wallet адрес');
      return;
    }
    searchUser();
  };

  const handleAddAdmin = () => {
    if (!searchedUser) {
      toast.error('Пользователь не найден');
      return;
    }

    // Проверяем, не является ли уже админом
    const isAlreadyAdmin = admins?.some(
      admin => admin.profile?.user_id === searchedUser.user_id
    );

    if (isAlreadyAdmin) {
      toast.error('Этот пользователь уже является админом');
      return;
    }

    addAdmin.mutate(searchedUser.user_id);
  };

  return (
    <div className="space-y-6">
      <Alert>
        <Shield className="h-4 w-4" />
        <AlertDescription>
          Будьте осторожны при назначении админов. Админы имеют полный доступ ко всем функциям системы.
        </AlertDescription>
      </Alert>

      {/* Поиск и добавление админа */}
      <Card>
        <CardHeader>
          <CardTitle>Добавить админа</CardTitle>
          <CardDescription>
            Найдите пользователя по wallet адресу и назначьте его админом
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="0x..."
              value={searchWallet}
              onChange={(e) => setSearchWallet(e.target.value)}
              className="flex-1"
            />
            <Button onClick={handleSearch} variant="outline">
              <Search className="h-4 w-4 mr-2" />
              Найти
            </Button>
          </div>

          {searchedUser && (
            <Card className="bg-muted/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Найден пользователь</p>
                    <p className="text-xs text-muted-foreground font-mono">
                      {searchedUser.wallet_address}
                    </p>
                  </div>
                  <Button
                    onClick={handleAddAdmin}
                    size="sm"
                    disabled={addAdmin.isPending}
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Назначить админом
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      {/* Список админов */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Текущие админы ({admins?.length || 0})
          </CardTitle>
          <CardDescription>
            Список всех пользователей с правами администратора
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            </div>
          ) : admins && admins.length > 0 ? (
            <div className="space-y-3">
              {admins.map((admin) => (
                <Card key={admin.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                          <Shield className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-mono text-sm">
                              {admin.profile?.wallet_address?.slice(0, 6)}...
                              {admin.profile?.wallet_address?.slice(-4)}
                            </p>
                            <Badge variant="default">Admin</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            ID: {admin.user_id.slice(0, 8)}...
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => removeAdmin.mutate(admin.user_id)}
                        disabled={removeAdmin.isPending || (admins.length <= 1)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Админы не найдены</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
