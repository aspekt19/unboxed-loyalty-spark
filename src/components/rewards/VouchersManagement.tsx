import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { Ticket, CheckCircle2, Search } from 'lucide-react';
import { useAccount } from 'wagmi';
import { Voucher } from '@/types/rewards';
import { getMerchantVouchers, updateVoucherStatus } from '@/lib/vouchers';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function VouchersManagement() {
  const { address } = useAccount();
  const { session } = useAuth();
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [searchCode, setSearchCode] = useState('');
  const [activeTab, setActiveTab] = useState('active');

  const loadMerchantVouchers = async () => {
    if (!address) {
      console.log('Cannot load vouchers: no address');
      return;
    }
    console.log('Loading merchant vouchers for address:', address);
    const merchantVouchers = await getMerchantVouchers(address);
    console.log('Loaded merchant vouchers:', merchantVouchers.length, 'vouchers');
    setVouchers(merchantVouchers);
  };

  // Очищаем ваучеры при отключении кошелька
  useEffect(() => {
    if (!address) {
      setVouchers([]);
      setSearchCode('');
    }
  }, [address]);

  useEffect(() => {
    // Загружаем ваучеры только если есть адрес и сессия
    if (!address || !session) return;
    
    console.log('[VouchersManagement] Initializing with session user:', session?.user?.id);
    
    loadMerchantVouchers();
    
    const handleUpdate = () => {
      // Немедленная загрузка при событии
      loadMerchantVouchers();
    };
    
    window.addEventListener('vouchersUpdated', handleUpdate);
    
    // Подписка на realtime обновления ваучеров - используем общий канал
    // Генерируем уникальное имя канала чтобы избежать конфликтов при переподключении
    const channelName = `vouchers_realtime_${Date.now()}`;
    console.log('[VouchersManagement] Setting up realtime subscription');
    console.log('[VouchersManagement] Merchant address:', address.toLowerCase());
    console.log('[VouchersManagement] Session user:', session.user.id);
    console.log('[VouchersManagement] Channel name:', channelName);
    
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'vouchers',
        },
        (payload) => {
          console.log('[VouchersManagement] ===== REALTIME EVENT RECEIVED =====');
          console.log('[VouchersManagement] Event type:', payload.eventType);
          console.log('[VouchersManagement] Full payload:', JSON.stringify(payload));
          
          // Проверяем, что это ваучер для этого мерчанта
          const voucherData = (payload.new || payload.old) as any;
          console.log('[VouchersManagement] Voucher data:', JSON.stringify(voucherData));
          
          if (voucherData?.merchant_address) {
            console.log('[VouchersManagement] Voucher merchant_address:', voucherData.merchant_address);
            console.log('[VouchersManagement] Current merchant address:', address.toLowerCase());
            console.log('[VouchersManagement] Addresses match:', voucherData.merchant_address === address.toLowerCase());
            
            if (voucherData.merchant_address === address.toLowerCase()) {
              console.log('[VouchersManagement] ✅ This voucher belongs to current merchant - reloading...');
              loadMerchantVouchers();
            } else {
              console.log('[VouchersManagement] ❌ This voucher belongs to different merchant - ignoring');
            }
          } else {
            console.log('[VouchersManagement] ⚠️ No merchant_address in voucher data');
          }
        }
      )
      .subscribe((status, err) => {
        console.log('[VouchersManagement] Subscription status:', status);
        if (err) {
          console.error('[VouchersManagement] Subscription error:', err);
        }
      });
    
    return () => {
      console.log('[VouchersManagement] Cleaning up subscription');
      window.removeEventListener('vouchersUpdated', handleUpdate);
      supabase.removeChannel(channel);
    };
  }, [address, session]);

  const handleMarkAsUsed = async (voucherId: string, code: string) => {
    const success = await updateVoucherStatus(voucherId, 'used');
    if (success) {
      toast.success(`Voucher ${code} marked as used`);
      window.dispatchEvent(new Event('vouchersUpdated'));
    } else {
      toast.error('Failed to update voucher');
    }
  };

  const filteredVouchers = searchCode
    ? vouchers.filter(v => v.code.toLowerCase().includes(searchCode.toLowerCase()))
    : vouchers;

  const activeVouchers = filteredVouchers.filter(v => v.status === 'active');
  const inactiveVouchers = filteredVouchers.filter(v => v.status === 'expired');
  const usedVouchers = filteredVouchers.filter(v => v.status === 'used');

  // Автоматическое переключение вкладки при поиске
  useEffect(() => {
    if (searchCode && filteredVouchers.length > 0) {
      const firstVoucher = filteredVouchers[0];
      if (firstVoucher.status === 'active' && activeTab !== 'active') {
        setActiveTab('active');
      } else if (firstVoucher.status === 'expired' && activeTab !== 'inactive') {
        setActiveTab('inactive');
      } else if (firstVoucher.status === 'used' && activeTab !== 'used') {
        setActiveTab('used');
      }
    }
  }, [searchCode, filteredVouchers]);

  if (!address) {
    return null;
  }

  return (
    <Card className="border-2 flex flex-col max-h-[calc(100vh-2rem)]">
      <CardHeader className="flex-shrink-0">
        <CardTitle className="flex items-center gap-2">
          <Ticket className="h-5 w-5 text-primary" />
          Issued Vouchers
        </CardTitle>
        <CardDescription>Manage customer vouchers</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden space-y-4">
        <div className="space-y-2">
          <Label htmlFor="search">Search by Code</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="search"
              placeholder="LOYAL-XXXX-XXXX"
              value={searchCode}
              onChange={(e) => setSearchCode(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {filteredVouchers.length === 0 ? (
          <Alert>
            <AlertDescription>
              {searchCode ? 'No vouchers found matching your search.' : 'No vouchers issued yet.'}
            </AlertDescription>
          </Alert>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
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
                <ScrollArea className="h-[400px] pr-4">
                  <div className="space-y-2">
                    {activeVouchers.map((voucher) => (
                      <div
                        key={voucher.id}
                        className="flex flex-col gap-2 p-2.5 border rounded-lg bg-primary/5"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <code className="font-bold text-xs">{voucher.code}</code>
                            <Badge variant="default" className="text-[10px] px-1.5 py-0 h-4">
                              Active
                            </Badge>
                          </div>
                          <div className="text-xs font-medium truncate">{voucher.rewardName}</div>
                          <div className="text-[10px] text-muted-foreground">
                            Activated: {new Date(voucher.activatedAt).toLocaleDateString()}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            Customer: {voucher.customerAddress.slice(0, 6)}...{voucher.customerAddress.slice(-4)}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleMarkAsUsed(voucher.id, voucher.code)}
                          className="gap-1.5 h-7 w-full text-xs"
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          <span>Mark as Used</span>
                        </Button>
                      </div>
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
                <ScrollArea className="h-[400px] pr-4">
                  <div className="space-y-2">
                    {inactiveVouchers.map((voucher) => (
                      <div
                        key={voucher.id}
                        className="flex flex-col gap-2 p-2.5 border rounded-lg bg-muted/50 opacity-70"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <code className="font-bold text-xs">{voucher.code}</code>
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                              Inactive
                            </Badge>
                          </div>
                          <div className="text-xs font-medium truncate">{voucher.rewardName}</div>
                          <div className="text-[10px] text-muted-foreground">
                            Activated: {new Date(voucher.activatedAt).toLocaleDateString()}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            Customer: {voucher.customerAddress.slice(0, 6)}...{voucher.customerAddress.slice(-4)}
                          </div>
                          <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                            Program is paused - voucher cannot be used
                          </p>
                        </div>
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
                <ScrollArea className="h-[400px] pr-4">
                  <div className="space-y-2">
                    {usedVouchers.map((voucher) => (
                      <div
                        key={voucher.id}
                        className="flex flex-col gap-1.5 p-2.5 border rounded-lg opacity-60"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <code className="font-bold text-xs">{voucher.code}</code>
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">Used</Badge>
                          </div>
                          <div className="text-xs font-medium truncate">{voucher.rewardName}</div>
                          <div className="text-[10px] text-muted-foreground">
                            Used: {voucher.usedAt && new Date(voucher.usedAt).toLocaleDateString()}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            Customer: {voucher.customerAddress.slice(0, 6)}...{voucher.customerAddress.slice(-4)}
                          </div>
                        </div>
                      </div>
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
