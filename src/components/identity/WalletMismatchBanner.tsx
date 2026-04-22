import { useActiveWallet } from '@/contexts/ActiveWalletContext';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';

function shortAddr(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

/**
 * Shown above any onchain action group (mint, transfer, redeem, P2P)
 * when the user's selected primary wallet differs from the wallet
 * currently signed in via Privy/wagmi. Onchain actions must be blocked
 * until the user reconnects with the correct wallet.
 */
export function WalletMismatchBanner() {
  const { isWalletMismatch, activeWallet, connectedWallet } = useActiveWallet();
  if (!isWalletMismatch) return null;

  return (
    <Alert className="border-amber-500/50 bg-amber-500/10">
      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
      <AlertDescription className="text-xs text-amber-800 dark:text-amber-200">
        Ончейн-действия временно недоступны. Основным выбран{' '}
        <span className="font-mono">{activeWallet ? shortAddr(activeWallet) : '—'}</span>, а подключён{' '}
        <span className="font-mono">{connectedWallet ? shortAddr(connectedWallet) : '—'}</span>.
        Переподключитесь нужным кошельком, чтобы подписать транзакцию.
      </AlertDescription>
    </Alert>
  );
}
