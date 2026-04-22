import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Info, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const STORAGE_KEY = 'loyalspark:secondary-wallet-notice';

interface NoticeData {
  wallet: string;
  at: number;
}

function readNotice(): NoticeData | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as NoticeData;
    if (!parsed?.wallet) return null;
    return parsed;
  } catch {
    return null;
  }
}

function shorten(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function SecondaryWalletNotice() {
  const { user } = useAuth();
  const { address } = useAccount();
  const [notice, setNotice] = useState<NoticeData | null>(() => readNotice());
  const [primaryWallet, setPrimaryWallet] = useState<string | null>(null);

  useEffect(() => {
    setNotice(readNotice());
  }, [user?.id]);

  useEffect(() => {
    if (!user || !notice) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('identity_links')
        .select('wallet_address')
        .eq('user_id', user.id)
        .eq('is_primary', true)
        .maybeSingle();
      if (!cancelled && data?.wallet_address) {
        setPrimaryWallet(data.wallet_address);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, notice]);

  if (!notice) return null;

  const dismiss = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    setNotice(null);
  };

  const isCurrentTheSecondary = address?.toLowerCase() === notice.wallet.toLowerCase();

  return (
    <Alert className="border-2 border-primary/30 bg-primary/5">
      <Info className="h-5 w-5 text-primary" />
      <AlertTitle className="text-base font-semibold mb-2 pr-8">
        New wallet linked automatically
      </AlertTitle>
      <AlertDescription className="space-y-3">
        <p className="text-sm">
          A new wallet <span className="font-mono">{shorten(notice.wallet)}</span> was created by
          Privy when you signed in with your email.
          {primaryWallet && (
            <>
              {' '}Your <strong>primary wallet</strong> is still{' '}
              <span className="font-mono">{shorten(primaryWallet)}</span>
              {isCurrentTheSecondary && ' — switch to it to access your data and balances.'}.
            </>
          )}
        </p>
        <p className="text-xs text-muted-foreground">
          You can swap which wallet is primary in the <strong>Primary wallet</strong> section below.
        </p>
        <Button onClick={dismiss} size="sm" variant="outline">
          Got it
        </Button>
      </AlertDescription>
      <button
        onClick={dismiss}
        className="absolute right-2 top-2 p-1 rounded-md hover:bg-muted transition-colors"
        aria-label="Dismiss"
        type="button"
      >
        <X className="h-4 w-4" />
      </button>
    </Alert>
  );
}
