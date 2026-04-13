import { usePrivy as usePrivyOriginal } from '@privy-io/react-auth';
import { isFarcasterContext } from '@/config/wagmi';
import { useEffect } from 'react';

const isFarcaster = isFarcasterContext();

interface PrivySafeResult {
  login: () => void;
  logout: () => Promise<void>;
  authenticated: boolean;
  user: any;
  ready: boolean;
  getAccessToken: () => Promise<string | null>;
}

const noopResult: PrivySafeResult = {
  login: () => {},
  logout: async () => {},
  authenticated: false,
  user: null,
  ready: false,
  getAccessToken: async () => null,
};

/**
 * Safe wrapper around usePrivy that returns no-op values in Farcaster context
 * where PrivyProvider is not available.
 */
export function usePrivySafe(): PrivySafeResult {
  if (isFarcaster) {
    return noopResult;
  }

  // In non-Farcaster context, PrivyProvider is always present
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const privy = usePrivyOriginal();

  // Keep access token fresh on window for AuthContext
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (privy.authenticated && privy.getAccessToken) {
      privy.getAccessToken().then((token) => {
        if (token) {
          (window as any).__privyAccessToken = token;
        }
      });
    } else {
      (window as any).__privyAccessToken = null;
    }
  }, [privy.authenticated, privy.user]);

  return {
    login: privy.login,
    logout: privy.logout,
    authenticated: privy.authenticated,
    user: privy.user,
    ready: privy.ready,
    getAccessToken: privy.getAccessToken,
  };
}
