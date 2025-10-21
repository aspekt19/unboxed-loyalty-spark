import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

  const loadMerchantVouchers = async () => {
    if (!address || !session) return;
    const merchantVouchers = await getMerchantVouchers(address);
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
    // Загружаем ваучеры только если есть адрес и пользователь авторизован
    if (!address || !session) return;
    
    loadMerchantVouchers();
    
    const handleUpdate = () => {
      setTimeout(() => loadMerchantVouchers(), 500);
    };
    
    window.addEventListener('vouchersUpdated', handleUpdate);
    window.addEventListener('profileMigrated', handleUpdate);
    
    // Подписка на realtime обновления ваучеров с уникальным именем канала
    const channelName = `vouchers_merchant_${address.toLowerCase()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'vouchers',
          filter: `merchant_address=eq.${address.toLowerCase()}`,
        },
        () => {
          console.log('Voucher changed, reloading...');
          loadMerchantVouchers();
        }
      )
      .subscribe();
    
    return () => {
      window.removeEventListener('vouchersUpdated', handleUpdate);
      window.removeEventListener('profileMigrated', handleUpdate);
      channel.unsubscribe();
    };
  }, [address, session]);

  // Auto-refresh vouchers every 5 seconds for real-time updates
  useEffect(() => {
    if (!address || !session) {
      return;
    }

    console.log('Starting auto-refresh for merchant vouchers...');
    const interval = setInterval(() => {
      console.log('Auto-refreshing merchant vouchers...');
      loadMerchantVouchers();
    }, 5000); // Refresh every 5 seconds

    return () => {
      console.log('Stopping auto-refresh for merchant vouchers');
      clearInterval(interval);
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
  const usedVouchers = filteredVouchers.filter(v => v.status === 'used');

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
          <div className="space-y-6">
            {activeVouchers.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                  Active Vouchers ({activeVouchers.length})
                </h3>
                <div className="space-y-2">
                  {activeVouchers.map((voucher) => (
                    <div
                      key={voucher.id}
                      className="flex items-center justify-between p-4 border rounded-lg bg-primary/5"
                    >
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <code className="font-bold">{voucher.code}</code>
                          <Badge>Active</Badge>
                        </div>
                        <div className="text-sm font-medium">{voucher.rewardName}</div>
                        <div className="text-xs text-muted-foreground">
                          Activated: {new Date(voucher.activatedAt).toLocaleDateString()}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Customer: {voucher.customerAddress.slice(0, 6)}...{voucher.customerAddress.slice(-4)}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleMarkAsUsed(voucher.id, voucher.code)}
                        className="gap-2"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Mark as Used
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {usedVouchers.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                  Used Vouchers ({usedVouchers.length})
                </h3>
                <div className="space-y-2">
                  {usedVouchers.map((voucher) => (
                    <div
                      key={voucher.id}
                      className="flex items-center justify-between p-4 border rounded-lg opacity-60"
                    >
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <code className="font-bold">{voucher.code}</code>
                          <Badge variant="secondary">Used</Badge>
                        </div>
                        <div className="text-sm font-medium">{voucher.rewardName}</div>
                        <div className="text-xs text-muted-foreground">
                          Used: {voucher.usedAt && new Date(voucher.usedAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
