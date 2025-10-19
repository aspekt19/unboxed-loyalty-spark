import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { VoucherCard } from './VoucherCard';
import { Ticket, AlertCircle } from 'lucide-react';
import { useAccount } from 'wagmi';
import { Voucher } from '@/types/rewards';
import { getCustomerVouchers } from '@/lib/vouchers';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function MyVouchers() {
  const { address } = useAccount();
  const [vouchers, setVouchers] = useState<Voucher[]>([]);

  const loadVouchers = async () => {
    if (!address) return;
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
    loadVouchers();
    window.addEventListener('vouchersUpdated', loadVouchers);
    return () => window.removeEventListener('vouchersUpdated', loadVouchers);
  }, [address]);

  if (!address) {
    return null;
  }

  const activeVouchers = vouchers.filter(v => v.status === 'active');
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
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="active">
                Active ({activeVouchers.length})
              </TabsTrigger>
              <TabsTrigger value="used">
                Used ({usedVouchers.length})
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="active" className="space-y-4 mt-4">
              {activeVouchers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No active vouchers
                </p>
              ) : (
                activeVouchers.map(voucher => (
                  <VoucherCard key={voucher.id} voucher={voucher} />
                ))
              )}
            </TabsContent>
            
            <TabsContent value="used" className="space-y-4 mt-4">
              {usedVouchers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No used vouchers
                </p>
              ) : (
                usedVouchers.map(voucher => (
                  <VoucherCard key={voucher.id} voucher={voucher} />
                ))
              )}
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}
