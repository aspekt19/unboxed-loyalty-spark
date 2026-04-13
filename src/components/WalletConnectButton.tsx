import { LogIn, User } from 'lucide-react';
import { useDisconnect, useConnect, useAccount } from 'wagmi';
import { useAuth } from '@/contexts/AuthContext';
import { sdk } from '@farcaster/miniapp-sdk';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useState, useEffect } from 'react';
import { isFarcasterContext } from '@/config/wagmi';

// Conditionally import Privy (only used in non-Farcaster context)
let usePrivyHook: (() => { login: () => void; logout: () => Promise<void>; authenticated: boolean; user: any }) | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const privy = await import('@privy-io/react-auth');
  usePrivyHook = privy.usePrivy;
} catch {
  // Privy not available (Farcaster context)
}

/** Format display name: show short address or ENS */
const formatDisplayName = (displayName: string) => {
  if (displayName.includes('.')) return displayName;
  return displayName;
};

export function WalletConnectButton() {
  const { disconnect } = useDisconnect();
  const { connect, connectors } = useConnect();
  const { address, isConnected } = useAccount();
  const { signOut, signInWithWallet, resetManualSignOut, user } = useAuth();
  const [isManuallyDisconnected, setIsManuallyDisconnected] = useState(false);
  const [farcasterUser, setFarcasterUser] = useState<{
    username?: string;
    displayName?: string;
    pfpUrl?: string;
  } | null>(null);

  const isFarcaster = isFarcasterContext();

  // Try to use Privy hook (only works in non-Farcaster context)
  let privyLogin: (() => void) | null = null;
  let privyLogout: (() => Promise<void>) | null = null;
  let privyAuthenticated = false;
  let privyUser: any = null;

  if (!isFarcaster && usePrivyHook) {
    try {
      const privy = usePrivyHook();
      privyLogin = privy.login;
      privyLogout = privy.logout;
      privyAuthenticated = privy.authenticated;
      privyUser = privy.user;
    } catch {
      // Privy not in provider tree
    }
  }

  useEffect(() => {
    const loadFarcasterUser = async () => {
      try {
        const context = await sdk.context;
        if (context?.user) {
          setFarcasterUser({
            username: context.user.username,
            displayName: context.user.displayName,
            pfpUrl: context.user.pfpUrl,
          });
        }
      } catch {
        // Not in Farcaster context
      }
    };
    loadFarcasterUser();
  }, []);
  
  // Auto-connect wallet in Farcaster context
  useEffect(() => {
    if (isFarcaster && !isConnected && !isManuallyDisconnected && connectors.length > 0) {
      setTimeout(() => {
        connect({ connector: connectors[0] });
      }, 500);
    }
  }, [connectors.length]);
  
  // Auto sign-in on reconnect in Farcaster
  useEffect(() => {
    if (isFarcaster && isConnected && address && !isManuallyDisconnected) {
      setTimeout(() => {
        signInWithWallet();
      }, 300);
    }
  }, [isConnected, address, isManuallyDisconnected, signInWithWallet]);
  
  const handleDisconnect = async () => {
    try {
      setIsManuallyDisconnected(true);
      await signOut();
      if (privyLogout) {
        await privyLogout();
      }
    } catch (error) {
      console.error('[WalletButton] Disconnect error:', error);
    }
  };
  
  const handleConnect = () => {
    setIsManuallyDisconnected(false);
    resetManualSignOut();

    if (isFarcaster) {
      connect({ connector: connectors[0] });
      if (isConnected && address) {
        setTimeout(() => signInWithWallet(), 300);
      }
    } else if (privyLogin) {
      privyLogin();
    }
  };

  // Farcaster UI
  if (farcasterUser) {
    if (!isConnected || isManuallyDisconnected) {
      return (
        <button
          onClick={handleConnect}
          type="button"
          className="px-5 py-2.5 rounded-lg font-semibold bg-gradient-uds text-white hover:opacity-90 transition-all duration-200 flex items-center gap-2"
        >
          <LogIn className="h-4 w-4" />
          <span>Sign In</span>
        </button>
      );
    }

    return (
      <button
        onClick={handleDisconnect}
        type="button"
        className="px-4 py-2 rounded-xl font-bold bg-gradient-uds text-white hover:opacity-90 shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2"
      >
        {(farcasterUser?.pfpUrl || farcasterUser?.username) && (
          <Avatar className="h-6 w-6">
            {farcasterUser?.pfpUrl && (
              <AvatarImage src={farcasterUser.pfpUrl} alt={farcasterUser.username || farcasterUser.displayName || 'User'} />
            )}
            <AvatarFallback className="text-xs bg-primary text-primary-foreground">
              {(farcasterUser?.displayName?.[0] || farcasterUser?.username?.[0] || 'U').toUpperCase()}
            </AvatarFallback>
          </Avatar>
        )}
        <span className="text-xs">
          {farcasterUser?.displayName || farcasterUser?.username || `${address?.slice(0, 6)}...${address?.slice(-4)}`}
        </span>
      </button>
    );
  }
  
  // Regular browser — Privy UI
  if (!isConnected || isManuallyDisconnected) {
    return (
      <button
        onClick={handleConnect}
        type="button"
        className="px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg font-semibold bg-gradient-uds text-white hover:opacity-90 shadow-md hover:shadow-lg transition-all duration-200 flex items-center gap-1 sm:gap-2 text-xs sm:text-sm h-8 sm:h-9"
      >
        <LogIn className="h-3 w-3 sm:h-4 sm:w-4" />
        <span>Sign In</span>
      </button>
    );
  }

  // Connected state
  const displayAddress = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '';
  const displayName = privyUser?.email?.address || privyUser?.phone?.number || displayAddress;

  return (
    <button
      onClick={handleDisconnect}
      type="button"
      className="px-3 py-1.5 rounded-lg font-bold bg-uds-purple text-white hover:bg-uds-purple-light shadow-md hover:shadow-lg transition-all duration-200 flex items-center gap-1.5"
    >
      <User className="h-3 w-3" />
      <span className="text-xs">{displayName}</span>
    </button>
  );
}
