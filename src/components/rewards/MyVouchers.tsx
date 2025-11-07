import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { VoucherCard } from './VoucherCard';
import { Ticket, AlertCircle } from 'lucide-react';
import { useAccount } from 'wagmi';
import { Voucher } from '@/types/rewards';
import { getCustomerVouchers } from '@/lib/vouchers';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function MyVouchers() {
  const { address } = useAccount();
  const { session } = useAuth();
  const [vouchers, setVouchers] = useState<Voucher[]>([]);

  const loadVouchers = async () => {
    if (!address || !session) return;
    const customerVouchers = await getCustomerVouchers(address);
    setVouchers(customerVouchers);
  };

  // Очищаем ваучеры при отключении кошелька
  useEffect(() => {
    if (!address) {
      setVouchers([]);
    }
  }, [address]);

  useEffect(() => {
    // Загружаем ваучеры только если есть адрес и пользователь авторизован
    if (!address || !session) return;
    
    loadVouchers();
    window.addEventListener('vouchersUpdated', loadVouchers);
    
    // Подписка на изменения в таблице vouchers для реалтайм обновлений
    const channel = supabase
      .channel('vouchers_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'vouchers',
          filter: `customer_address=eq.${address.toLowerCase()}`,
        },
        (payload) => {
          console.log('Voucher status changed:', payload);
          loadVouchers();
        }
      )
      .subscribe();
    
    return () => {
      window.removeEventListener('vouchersUpdated', loadVouchers);
      supabase.removeChannel(channel);
    };
  }, [address, session]);

  if (!address) {
    return null;
  }

  const activeVouchers = vouchers.filter(v => v.status === 'active');
  const inactiveVouchers = vouchers.filter(v => v.status === 'expired');
  const usedVouchers = vouchers.filter(v => v.status === 'used');

  return (
    <Card className="border-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Ticket className="h-5 w-5 text-primary" />
          My Vouchers
        </CardTitle>
        <CardDescription>Your activated reward vouchers</CardDescription>
      </CardHeader>
      <CardContent>
        {vouchers.length === 0 ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No vouchers yet. Activate rewards to get vouchers!
            </AlertDescription>
          </Alert>
        ) : (
          <Tabs defaultValue="active" className="w-full">
            <TabsList className="grid w-full grid-cols-3 h-8">
              <TabsTrigger value="active" className="text-xs">
                Active ({activeVouchers.length})
              </TabsTrigger>
              <TabsTrigger value="inactive" className="text-xs">
                Inactive ({inactiveVouchers.length})
              </TabsTrigger>
              <TabsTrigger value="used" className="text-xs">
                Used ({usedVouchers.length})
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="active" className="mt-4">
              {activeVouchers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No active vouchers
                </p>
              ) : (
                <ScrollArea className="h-[300px] pr-4">
                  <div className="space-y-4">
                    {activeVouchers.map(voucher => (
                      <VoucherCard key={voucher.id} voucher={voucher} />
                    ))}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>
            
            <TabsContent value="inactive" className="mt-4">
              {inactiveVouchers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No inactive vouchers
                </p>
              ) : (
                <ScrollArea className="h-[300px] pr-4">
                  <div className="space-y-4">
                    {inactiveVouchers.map(voucher => (
                      <div key={voucher.id}>
                        <VoucherCard voucher={voucher} />
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>
            
            <TabsContent value="used" className="mt-4">
              {usedVouchers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No used vouchers
                </p>
              ) : (
                <ScrollArea className="h-[300px] pr-4">
                  <div className="space-y-4">
                    {usedVouchers.map(voucher => (
                      <VoucherCard key={voucher.id} voucher={voucher} />
                    ))}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}
