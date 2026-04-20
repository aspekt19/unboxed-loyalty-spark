import { useEffect, useRef } from 'react';
import { useAccount, useConnect } from 'wagmi';
import { sdk } from '@farcaster/miniapp-sdk';

/**
 * Farcaster miniapp auto-connect:
 * As soon as the app mounts inside a Farcaster client, silently connect the
 * `farcasterMiniApp` wagmi connector so the user's Farcaster wallet is
 * available without any manual click. AuthContext then auto-runs SIWE.
 */
export function FarcasterAutoConnect() {
  const { isConnected } = useAccount();
  const { connect, connectors, status } = useConnect();
  const triedRef = useRef(false);

  useEffect(() => {
    if (isConnected || triedRef.current) return;
    if (status === 'pending') return;

    const connector = connectors[0];
    if (!connector) return;

    triedRef.current = true;
    // Notify Farcaster the UI is ready, then connect.
    sdk.actions.ready().catch(() => {});
    try {
      connect({ connector });
    } catch (err) {
      console.warn('[FarcasterAutoConnect] connect failed', err);
    }
  }, [isConnected, connect, connectors, status]);

  return null;
}
