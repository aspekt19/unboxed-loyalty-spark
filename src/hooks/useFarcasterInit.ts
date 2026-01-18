import { useEffect, useRef, useState, useCallback } from 'react';
import { useConnect, useAccount } from 'wagmi';
import { sdk } from '@farcaster/miniapp-sdk';

interface FarcasterUser {
  username?: string;
  displayName?: string;
  pfpUrl?: string;
}

// Detect if running inside Farcaster miniapp (synchronous check)
export const isFarcasterContext = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const hasFarcasterParam = urlParams.has('farcaster') || urlParams.has('fc');
    const isFarcasterPath = window.location.pathname.includes('/frame');
    const hasFarcasterUA = /farcaster/i.test(navigator.userAgent);
    return hasFarcasterParam || isFarcasterPath || hasFarcasterUA;
  } catch {
    return false;
  }
};

export function useFarcasterInit() {
  const { connect, connectors } = useConnect();
  const { isConnected } = useAccount();
  const [farcasterUser, setFarcasterUser] = useState<FarcasterUser | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const initAttemptedRef = useRef(false);
  const connectAttemptedRef = useRef(false);

  const initializeFarcaster = useCallback(async () => {
    if (initAttemptedRef.current) return;
    initAttemptedRef.current = true;

    console.log('[FarcasterInit] Starting initialization...');

    try {
      // Step 1: Load SDK context (contains user info)
      console.log('[FarcasterInit] Loading SDK context...');
      const context = await Promise.race([
        sdk.context,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000))
      ]);

      if (context?.user) {
        const userData: FarcasterUser = {
          username: context.user.username,
          displayName: context.user.displayName,
          pfpUrl: context.user.pfpUrl,
        };
        console.log('[FarcasterInit] User loaded:', userData);
        setFarcasterUser(userData);
      }

      // Step 2: Signal to Farcaster that we're ready to be displayed
      console.log('[FarcasterInit] Calling sdk.actions.ready()...');
      await sdk.actions.ready();
      console.log('[FarcasterInit] SDK ready signaled');
      
      setIsReady(true);
    } catch (error) {
      console.error('[FarcasterInit] Initialization error:', error);
      // Still mark as ready even on error to prevent blocking
      setIsReady(true);
    } finally {
      setIsInitializing(false);
    }
  }, []);

  // Auto-connect wallet after SDK is ready
  useEffect(() => {
    if (!isReady || isConnected || connectAttemptedRef.current) return;
    if (!isFarcasterContext()) return;
    if (connectors.length === 0) return;

    connectAttemptedRef.current = true;
    console.log('[FarcasterInit] Auto-connecting wallet...');
    
    // Connect using the farcasterMiniApp connector (should be first)
    const farcasterConnector = connectors.find(c => c.id === 'farcasterMiniApp') || connectors[0];
    
    connect(
      { connector: farcasterConnector },
      {
        onSuccess: () => {
          console.log('[FarcasterInit] Wallet connected successfully');
        },
        onError: (error) => {
          console.error('[FarcasterInit] Wallet connection error:', error);
          // Allow retry
          connectAttemptedRef.current = false;
        }
      }
    );
  }, [isReady, isConnected, connectors, connect]);

  // Initialize on mount if in Farcaster context
  useEffect(() => {
    if (isFarcasterContext() && !initAttemptedRef.current) {
      initializeFarcaster();
    } else {
      setIsInitializing(false);
      setIsReady(true);
    }
  }, [initializeFarcaster]);

  return {
    farcasterUser,
    isReady,
    isInitializing,
    isFarcaster: isFarcasterContext(),
    reinitialize: useCallback(() => {
      initAttemptedRef.current = false;
      connectAttemptedRef.current = false;
      initializeFarcaster();
    }, [initializeFarcaster])
  };
}
