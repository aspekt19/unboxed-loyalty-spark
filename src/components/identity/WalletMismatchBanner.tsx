import { useActiveWallet } from '@/contexts/ActiveWalletContext';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { useDisconnect } from 'wagmi';
import { usePrivySafe } from '@/hooks/usePrivySafe';
import { isFarcasterContext } from '@/config/wagmi';
import { toast } from 'sonner';

function shortAddr(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

/**
 * Shown above any onchain action group (mint, transfer, redeem, P2P)
 * when the user's selected primary wallet differs from the wallet
 * currently signed in via Privy/wagmi. Onchain actions must be blocked
 * until the user reconnects with the correct wallet.
 *
 * Action button:
 * - If the currently connected wallet is in the user's linked set,
 *   switch primary to it (one click — no signature needed).
 * - Otherwise, disconnect Privy/wagmi and prompt re-login so the user
 *   can connect the wallet that matches their chosen primary.
 */
export function WalletMismatchBanner() {
  const {
    isWalletMismatch,
    activeWallet,
    connectedWallet,
    linkedWallets,
    setPrimary,
  } = useActiveWallet();
  const { disconnectAsync } = useDisconnect();
  const { logout: privyLogout, login: privyLogin } = usePrivySafe();
  const [busy, setBusy] = useState(false);

  if (!isWalletMismatch) return null;

  const connectedIsLinked = Boolean(
    connectedWallet &&
      linkedWallets.some(
        (l) => l.wallet_address.toLowerCase() === connectedWallet,
      ),
  );

  const handleSwitchPrimary = async () => {
    if (!connectedWallet) return;
    setBusy(true);
    const result = await setPrimary(connectedWallet);
    setBusy(false);
    if (result.ok) {
      toast.success(`Основным назначен ${shortAddr(connectedWallet)}`);
    } else {
      toast.error(result.error ?? 'Не удалось переключить основной кошелёк');
    }
  };

  const handleReconnect = async () => {
    setBusy(true);
    try {
      try {
        await disconnectAsync?.();
      } catch {}
      if (!isFarcasterContext()) {
        try {
          await privyLogout();
        } catch {}
        // Brief delay so Privy fully clears state before re-opening modal.
        setTimeout(() => {
          try {
            privyLogin();
          } catch {}
        }, 300);
      }
      toast.info('Подключите кошелёк, выбранный основным');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Alert className="border-amber-500/50 bg-amber-500/10">
      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
      <AlertDescription className="text-xs text-amber-800 dark:text-amber-200">
        <div className="space-y-2">
          <div>
            Ончейн-действия временно недоступны. Основным выбран{' '}
            <span className="font-mono">{activeWallet ? shortAddr(activeWallet) : '—'}</span>, а подключён{' '}
            <span className="font-mono">{connectedWallet ? shortAddr(connectedWallet) : '—'}</span>.
            Переподключитесь нужным кошельком, чтобы подписать транзакцию.
          </div>
          <div className="flex flex-wrap gap-2">
            {connectedIsLinked && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs border-amber-500/60 bg-background hover:bg-amber-500/20"
                onClick={handleSwitchPrimary}
                disabled={busy}
              >
                {busy ? (
                  <RefreshCw className="h-3 w-3 mr-1.5 animate-spin" />
                ) : null}
                Сделать {shortAddr(connectedWallet!)} основным
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs border-amber-500/60 bg-background hover:bg-amber-500/20"
              onClick={handleReconnect}
              disabled={busy}
            >
              {busy ? (
                <RefreshCw className="h-3 w-3 mr-1.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3 mr-1.5" />
              )}
              Переподключить основной кошелёк
            </Button>
          </div>
        </div>
      </AlertDescription>
    </Alert>
  );
}
