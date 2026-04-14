import { useCallback, useEffect, useRef } from 'react';
import { useConfig, useDisconnect } from 'wagmi';
import { useAuth } from '@/contexts/AuthContext';
import { usePrivySafe } from '@/hooks/usePrivySafe';
import { isFarcasterContext } from '@/config/wagmi';
import { WALLET_CONNECTOR_ERROR_EVENT } from '@/constants/walletConnectorRecovery';

/**
 * Clears wagmi reconnect state and Privy session after connector/RPC failures
 * (e.g. MetaMask unavailable in Comet / mobile WebView) so the user sees Sign in again.
 */
export function ConnectorRecoveryListener() {
  const isFarcaster = isFarcasterContext();
  const { signOut } = useAuth();
  const { disconnectAsync } = useDisconnect();
  const config = useConfig();
  const { logout: privyLogout } = usePrivySafe();
  const busyRef = useRef(false);
  const debounceRef = useRef<number | null>(null);

  const recover = useCallback(async () => {
    if (isFarcaster || busyRef.current) return;
    busyRef.current = true;
    try {
      try {
        await disconnectAsync();
      } catch {
        // ignore — connector may already be invalid
      }

      const storage = config.storage;
      if (storage) {
        try {
          await storage.removeItem('state');
          await storage.removeItem('recentConnectorId');
        } catch {
          // ignore
        }
      }

      if (typeof window !== 'undefined') {
        const keys: string[] = [];
        for (let i = 0; i < window.localStorage.length; i++) {
          const k = window.localStorage.key(i);
          if (k?.startsWith('wagmi.')) keys.push(k);
        }
        for (const k of keys) {
          try {
            window.localStorage.removeItem(k);
          } catch {
            // ignore
          }
        }
      }

      await signOut({ variant: 'connector_recovery' });

      try {
        await privyLogout();
      } catch {
        // ignore
      }
    } catch (e) {
      console.error('[ConnectorRecoveryListener]', e);
    } finally {
      busyRef.current = false;
    }
  }, [isFarcaster, disconnectAsync, config, signOut, privyLogout]);

  useEffect(() => {
    if (isFarcaster) return;

    const schedule = () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(() => {
        debounceRef.current = null;
        void recover();
      }, 150);
    };

    window.addEventListener(WALLET_CONNECTOR_ERROR_EVENT, schedule);
    return () => {
      window.removeEventListener(WALLET_CONNECTOR_ERROR_EVENT, schedule);
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [isFarcaster, recover]);

  return null;
}
