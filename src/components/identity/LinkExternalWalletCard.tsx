import { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Wallet, Loader2, ShieldCheck, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { usePrivySafe } from '@/hooks/usePrivySafe';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useActiveWallet } from '@/contexts/ActiveWalletContext';

function shortAddr(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function getPrivyWalletAddresses(privyUser: any): string[] {
  if (!privyUser) return [];
  const set = new Set<string>();
  const push = (a?: string | null) => {
    if (a && typeof a === 'string') set.add(a.toLowerCase());
  };
  push(privyUser?.wallet?.address);
  push(privyUser?.smartWallet?.address);
  const linked = privyUser?.linked_accounts ?? privyUser?.linkedAccounts ?? [];
  for (const acc of linked) {
    if (acc?.type === 'wallet' || acc?.type === 'smart_wallet') {
      push(acc?.address);
    }
  }
  return Array.from(set);
}

export function LinkExternalWalletCard() {
  const { session } = useAuth();
  const privy = usePrivySafe();
  const { linkedWallets, refresh } = useActiveWallet();
  const [busy, setBusy] = useState(false);
  const baselineRef = useRef<Set<string> | null>(null);
  const linkedAddressSet = useMemo(
    () => new Set(linkedWallets.map((l) => l.wallet_address.toLowerCase())),
    [linkedWallets],
  );

  // Wallets known to Privy but not yet stored as identity_links
  const privyWallets = getPrivyWalletAddresses(privy.user);
  const unlinkedFromPrivy = privyWallets.filter((a) => !linkedAddressSet.has(a));

  // Auto-link any wallet that Privy added since baseline
  useEffect(() => {
    if (!session || !privy.authenticated) return;
    if (baselineRef.current === null) {
      baselineRef.current = new Set(privyWallets);
      return;
    }
    const newAddrs = privyWallets.filter(
      (a) => !baselineRef.current!.has(a) && !linkedAddressSet.has(a),
    );
    if (newAddrs.length === 0) return;

    let cancelled = false;
    (async () => {
      for (const addr of newAddrs) {
        try {
          await persistLink(addr);
          if (!cancelled) {
            toast.success(`Привязан кошелёк ${shortAddr(addr)}`);
            baselineRef.current!.add(addr);
          }
        } catch (e: any) {
          console.error('auto-link failed:', e);
          if (!cancelled) {
            const msg = e?.message ?? 'Не удалось привязать';
            toast.error(msg);
            // Don't retry on next render
            baselineRef.current!.add(addr);
          }
        }
      }
      if (!cancelled) await refresh();
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [privyWallets.join(','), session?.user?.id, privy.authenticated]);

  const persistLink = async (walletAddress: string) => {
    const privyToken = await privy.getAccessToken();
    if (!privyToken) throw new Error('Сессия Privy не готова — обновите страницу');

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const res = await fetch(`${supabaseUrl}/functions/v1/link-secondary-wallet`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${session!.access_token}`,
      },
      body: JSON.stringify({ privyToken, walletAddress }),
    });

    if (!res.ok) {
      let payload: { error?: string; message?: string } = {};
      try {
        payload = await res.json();
      } catch {
        // ignore
      }
      if (payload.error === 'wallet_owned_by_other_account') {
        throw new Error(
          'Этот кошелёк уже привязан к другому Loyal Spark аккаунту. Войдите тем аккаунтом, чтобы объединить.',
        );
      }
      throw new Error(payload.message || payload.error || 'Не удалось привязать кошелёк');
    }
  };

  const handleLink = async () => {
    if (!privy.ready) {
      toast.error('Сервис входа ещё не готов');
      return;
    }
    if (!privy.authenticated) {
      toast.error('Сначала войдите через email/Google');
      return;
    }
    setBusy(true);
    try {
      // Remember current set so the auto-link effect can detect what's new
      baselineRef.current = new Set(privyWallets);
      privy.linkWallet();
      toast.info('Подтвердите подключение в окне Privy');
    } catch (e: any) {
      console.error('linkWallet failed:', e);
      toast.error(e?.message ?? 'Не удалось открыть выбор кошелька');
    } finally {
      setBusy(false);
    }
  };

  const handlePersistKnown = async (addr: string) => {
    setBusy(true);
    try {
      await persistLink(addr);
      toast.success(`Привязан кошелёк ${shortAddr(addr)}`);
      await refresh();
    } catch (e: any) {
      toast.error(e?.message ?? 'Не удалось привязать');
    } finally {
      setBusy(false);
    }
  };

  if (!session) return null;

  return (
    <Card className="border-2">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Plus className="h-4 w-4 text-primary" />
          Привязать внешний кошелёк
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Добавьте MetaMask, Coinbase Wallet или другой внешний кошелёк к этому аккаунту.
          После привязки вы сможете выбрать его как основной.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {unlinkedFromPrivy.length > 0 && (
          <Alert>
            <ShieldCheck className="h-4 w-4" />
            <AlertDescription className="text-xs space-y-2">
              <p>
                Privy уже знает о {unlinkedFromPrivy.length === 1 ? 'кошельке' : 'кошельках'}, ещё
                не записанных в ваш аккаунт:
              </p>
              {unlinkedFromPrivy.map((a) => (
                <div key={a} className="flex items-center justify-between gap-2">
                  <span className="font-mono">{shortAddr(a)}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handlePersistKnown(a)}
                    disabled={busy}
                  >
                    Подтвердить
                  </Button>
                </div>
              ))}
            </AlertDescription>
          </Alert>
        )}

        <Button onClick={handleLink} disabled={busy || !privy.ready} className="w-full">
          {busy ? (
            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
          ) : (
            <Wallet className="h-4 w-4 mr-1.5" />
          )}
          Подключить кошелёк
        </Button>

        <Alert variant="default" className="border-amber-500/40 bg-amber-500/5">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-[11px]">
            Если Privy скажет «This account has already been linked to another user» — это значит,
            что выбранный кошелёк уже принадлежит другому Loyal Spark аккаунту. В этом случае
            выйдите и войдите тем аккаунтом — например, через MetaMask напрямую — а затем
            привяжите свою почту с этой страницы.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
