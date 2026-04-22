import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useActiveWallet } from '@/contexts/ActiveWalletContext';
import { supabase } from '@/integrations/supabase/client';
import { Layers, Loader2 } from 'lucide-react';

interface WalletStats {
  wallet: string;
  programsCount: number;
  vouchersCount: number;
}

function shortAddr(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function LinkedWalletsSummary() {
  const { linkedWallets, activeWallet } = useActiveWallet();
  const [stats, setStats] = useState<WalletStats[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (linkedWallets.length <= 1) {
      setStats([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const wallets = linkedWallets.map(l => l.wallet_address);

      // Vouchers count per customer
      const { data: vouchers } = await supabase
        .from('vouchers')
        .select('customer_address')
        .in('customer_address', wallets);

      // Programs holdings: how many distinct programs each wallet has tier_status in
      const { data: tierRows } = await supabase
        .from('customer_tier_status')
        .select('customer_address, token_address')
        .in('customer_address', wallets);

      if (cancelled) return;

      const result: WalletStats[] = wallets.map(w => {
        const vCount = (vouchers ?? []).filter(v => v.customer_address?.toLowerCase() === w).length;
        const pSet = new Set(
          (tierRows ?? [])
            .filter(t => t.customer_address?.toLowerCase() === w)
            .map(t => t.token_address),
        );
        return { wallet: w, programsCount: pSet.size, vouchersCount: vCount };
      });
      setStats(result);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [linkedWallets]);

  if (linkedWallets.length <= 1) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Layers className="h-4 w-4 text-primary" />
          Все мои аккаунты
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Сводка по связанным кошелькам. Активный отображается в основном интерфейсе.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Загрузка…
          </div>
        ) : (
          stats.map(s => (
            <div
              key={s.wallet}
              className={`flex items-center justify-between rounded-md border p-2.5 ${
                s.wallet === activeWallet ? 'border-primary bg-primary/5' : 'border-border'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-mono text-xs truncate">{shortAddr(s.wallet)}</span>
                {s.wallet === activeWallet ? (
                  <Badge variant="default" className="h-5 text-[10px]">Основной</Badge>
                ) : (
                  <Badge variant="outline" className="h-5 text-[10px]">Дополнительный</Badge>
                )}
              </div>
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-shrink-0">
                <span>Программ: <strong className="text-foreground">{s.programsCount}</strong></span>
                <span>Ваучеров: <strong className="text-foreground">{s.vouchersCount}</strong></span>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
