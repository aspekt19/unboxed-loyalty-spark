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

export function usePrivySafe(): PrivySafeResult {
  const isFarcaster = isFarcasterContext();

  if (isFarcaster || isLovablePreviewHost()) {
    return noopResult;
  }

  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const privy = usePrivyOriginal();
    // eslint-disable-next-line react-hooks/rules-of-hooks
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
  } catch {
    return noopResult;
  }
}
