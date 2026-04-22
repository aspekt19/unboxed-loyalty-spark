import { usePrivy as usePrivyOriginal } from '@privy-io/react-auth';
import { isFarcasterContext } from '@/config/wagmi';

const isFarcaster = isFarcasterContext();

type LoginOptions = Parameters<ReturnType<typeof usePrivyOriginal>['login']>[0];

interface PrivySafeResult {
  login: (options?: LoginOptions) => void;
  logout: () => Promise<void>;
  authenticated: boolean;
  user: any;
  ready: boolean;
  getAccessToken: () => Promise<string | null>;
  linkEmail: () => void;
  unlinkEmail: (email: string) => Promise<unknown>;
  linkWallet: () => void;
  unlinkWallet: (address: string) => Promise<unknown>;
}

const noopResult: PrivySafeResult = {
  login: () => {},
  logout: async () => {},
  authenticated: false,
  user: null,
  ready: false,
  getAccessToken: async () => null,
  linkEmail: () => {},
  unlinkEmail: async () => {},
  linkWallet: () => {},
  unlinkWallet: async () => {},
};

function isLovablePreviewHost(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host.endsWith('.lovableproject.com') || host.startsWith('id-preview--');
}

export function usePrivySafe(): PrivySafeResult {
  if (isFarcaster || isLovablePreviewHost()) {
    return noopResult;
  }

  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const privy = usePrivyOriginal();

    return {
      login: privy.login,
      logout: privy.logout,
      authenticated: privy.authenticated,
      user: privy.user,
      ready: privy.ready,
      getAccessToken: privy.getAccessToken,
      linkEmail: privy.linkEmail,
      unlinkEmail: privy.unlinkEmail,
      linkWallet: privy.linkWallet,
      unlinkWallet: privy.unlinkWallet,
    };
  } catch {
    return noopResult;
  }
}
