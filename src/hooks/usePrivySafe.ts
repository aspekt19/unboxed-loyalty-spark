import { usePrivy as usePrivyOriginal } from '@privy-io/react-auth';
import { isFarcasterContext } from '@/config/wagmi';

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

export function usePrivySafe(): PrivySafeResult {
  if (isFarcaster) {
    return noopResult;
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const privy = usePrivyOriginal();

  return {
    login: privy.login,
    logout: privy.logout,
    authenticated: privy.authenticated,
    user: privy.user,
    ready: privy.ready,
    getAccessToken: privy.getAccessToken,
  };
}
