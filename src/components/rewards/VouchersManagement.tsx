import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Ticket, Search, QrCode, X } from 'lucide-react';
import { useAccount } from 'wagmi';
import { Voucher } from '@/types/rewards';
import { getMerchantVouchers, updateVoucherStatus } from '@/lib/vouchers';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { VoucherListItem } from './VoucherListItem';
import { QrReader } from '@blackbox-vision/react-qr-reader';

export function VouchersManagement() {
  const { address } = useAccount();
  const { session } = useAuth();
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [searchCode, setSearchCode] = useState('');
  const [activeTab, setActiveTab] = useState('active');
  const [showScanner, setShowScanner] = useState(false);

  const loadMerchantVouchers = async () => {
    if (!address) return;
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
    if (!address || !session) return;
    
    loadMerchantVouchers();
    
    const handleUpdate = () => loadMerchantVouchers();
    window.addEventListener('vouchersUpdated', handleUpdate);
    
    // Realtime подписка на изменения ваучеров
    const channelName = `vouchers_realtime_${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'vouchers' },
        (payload) => {
          const voucherData = (payload.new || payload.old) as { merchant_address?: string } | null;
          if (voucherData?.merchant_address === address.toLowerCase()) {
            loadMerchantVouchers();
          }
        }
      )
      .subscribe();
    
    return () => {
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

  const handleQrScan = (result: { text?: string } | null | undefined) => {
    if (result?.text) {
      const scannedCode = result.text.trim();
      setShowScanner(false);
      setSearchCode(scannedCode);
      
      // Auto-find and offer to redeem
      const found = vouchers.find(v => v.code === scannedCode && v.status === 'active');
      if (found) {
        toast.success(`Voucher found: ${found.rewardName}`, {
          action: {
            label: 'Mark as Used',
            onClick: () => handleMarkAsUsed(found.id, found.code),
          },
        });
      } else {
        const usedVoucher = vouchers.find(v => v.code === scannedCode);
        if (usedVoucher) {
          toast.info(`Voucher already ${usedVoucher.status}`);
        } else {
          toast.error('Voucher not found');
        }
      }
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

  if (!address) return null;

  const renderVoucherList = (items: Voucher[], emptyMessage: string) => {
    if (items.length === 0) {
      return (
        <p className="text-sm text-muted-foreground text-center py-8">
          {emptyMessage}
        </p>
      );
    }
    return (
      <ScrollArea className="h-[400px] pr-4">
        <div className="space-y-2">
          {items.map((voucher) => (
            <VoucherListItem
              key={voucher.id}
              voucher={voucher}
              onMarkAsUsed={voucher.status === 'active' ? handleMarkAsUsed : undefined}
            />
          ))}
        </div>
      </ScrollArea>
    );
  };

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
          <div className="flex items-center justify-between">
            <Label htmlFor="search">Search by Code</Label>
            <Button
              type="button"
              variant="outline"
              size="default"
              onClick={() => setShowScanner(!showScanner)}
              className="h-9 px-3 border-primary/50 text-primary hover:bg-primary/10"
            >
              {showScanner ? <X className="h-4 w-4 mr-1.5" /> : <QrCode className="h-4 w-4 mr-1.5" />}
              {showScanner ? 'Close Scanner' : 'Scan QR Code'}
            </Button>
          </div>
          
          {showScanner ? (
            <div className="space-y-2">
              <div className="relative aspect-square w-full max-w-[250px] mx-auto overflow-hidden rounded-lg border-2">
                <QrReader
                  onResult={handleQrScan}
                  constraints={{ facingMode: 'environment' }}
                  containerStyle={{ width: '100%', height: '100%' }}
                  videoStyle={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Scan customer's voucher QR code
              </p>
            </div>
          ) : (
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
          )}
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
              {renderVoucherList(activeVouchers, 'No active vouchers')}
            </TabsContent>
            <TabsContent value="inactive" className="mt-4">
              {renderVoucherList(inactiveVouchers, 'No inactive vouchers')}
            </TabsContent>
            <TabsContent value="used" className="mt-4">
              {renderVoucherList(usedVouchers, 'No used vouchers')}
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}
