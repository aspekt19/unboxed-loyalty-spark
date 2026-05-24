import { usePrivy as usePrivyOriginal, useConnectWallet as useConnectWalletOriginal } from '@privy-io/react-auth';
import { isFarcasterContext } from '@/config/wagmi';

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

function isLovablePreviewHost(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host.endsWith('.lovableproject.com') || host.startsWith('id-preview--');
}

/**
 * Decide ONCE per module load which implementation to expose. This keeps
 * Rules of Hooks intact — every render of a component using `usePrivySafe`
 * calls the same hook implementation, never a conditional one.
 *
 * - Farcaster / Lovable preview → no Privy provider in the tree → noop.
 * - Regular browser → real Privy hooks.
 */
const SHOULD_USE_NOOP =
  typeof window !== 'undefined' && (isFarcasterContext() || isLovablePreviewHost());

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

function usePrivyNoop(): PrivySafeResult {
  return noopResult;
}

export const usePrivySafe: () => PrivySafeResult = SHOULD_USE_NOOP ? usePrivyNoop : usePrivyReal;
