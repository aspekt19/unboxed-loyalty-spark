import { createContext, useContext } from 'react';
import {
  usePrivy as usePrivyOriginal,
  useConnectWallet as useConnectWalletOriginal,
} from '@privy-io/react-auth';

interface PrivySafeResult {
  login: () => void;
  logout: () => Promise<void>;
  authenticated: boolean;
  user: any;
  ready: boolean;
  getAccessToken: () => Promise<string | null>;
  connectWallet: () => void;
}

const noopResult: PrivySafeResult = {
  login: () => {},
  logout: async () => {},
  authenticated: false,
  user: null,
  ready: false,
  getAccessToken: async () => null,
  connectWallet: () => {},
};

/**
 * Source of truth for whether the surrounding React tree mounts a real
 * <PrivyProvider>. Decided in App.tsx once Farcaster detection resolves, then
 * frozen for the lifetime of that provider tree — so the hook call order is
 * stable per component instance (Rules of Hooks compliant).
 *
 * Default `false` matches no-Privy trees (Farcaster, native preview).
 */
export const PrivyAvailableContext = createContext<boolean>(false);

function usePrivyReal(): PrivySafeResult {
  const privy = usePrivyOriginal();
  const { connectWallet } = useConnectWalletOriginal();
  return {
    login: privy.login,
    logout: privy.logout,
    authenticated: privy.authenticated,
    user: privy.user,
    ready: privy.ready,
    getAccessToken: privy.getAccessToken,
    connectWallet,
  };
}

export function usePrivySafe(): PrivySafeResult {
  const available = useContext(PrivyAvailableContext);
  // Stable for the lifetime of the surrounding provider tree (App.tsx waits
  // for Farcaster detection before mounting providers, and the context value
  // never flips within a tree). eslint-disable: same hook order per instance.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return available ? usePrivyReal() : noopResult;
}
