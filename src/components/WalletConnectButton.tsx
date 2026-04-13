import { LogIn, User } from 'lucide-react';
import { useDisconnect, useConnect, useAccount } from 'wagmi';
import { useAuth } from '@/contexts/AuthContext';
import { sdk } from '@farcaster/miniapp-sdk';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useState, useEffect, useRef } from 'react';
import { isFarcasterContext } from '@/config/wagmi';
import { usePrivySafe } from '@/hooks/usePrivySafe';

/**
 * Determine if the Privy user authenticated via social/email (not direct wallet).
 * If so, we use Privy-based auth (no SIWE signature needed).
 */
function isPrivySocialLogin(privyUser: any): boolean {
  if (!privyUser) return false;
  // If user has email, google, phone, etc. — they used social login
  // Even if they also have a wallet (embedded), the primary auth was social
  return !!(privyUser.email || privyUser.google || privyUser.phone || privyUser.apple || privyUser.twitter);
}

export function WalletConnectButton() {
  const { disconnect } = useDisconnect();
  const { connect, connectors } = useConnect();
  const { address, isConnected } = useAccount();
  const { user, signOut, signInWithWallet, signInWithPrivy, resetManualSignOut } = useAuth();
  const [isManuallyDisconnected, setIsManuallyDisconnected] = useState(false);
  const [farcasterUser, setFarcasterUser] = useState<{
    username?: string;
    displayName?: string;
    pfpUrl?: string;
  } | null>(null);

  const isFarcaster = isFarcasterContext();
  const { login: privyLogin, logout: privyLogout, user: privyUser, ready: privyReady, authenticated: privyAuthenticated } = usePrivySafe();
  const prevPrivyUserRef = useRef(privyUser);

  // Expose Privy user data and access token for AuthContext to read
  useEffect(() => {
    if (privyUser) {
      (window as any).__privyUser = privyUser;
    }
  }, [privyUser]);

  // Expose Privy access token
  useEffect(() => {
    if (!isFarcaster && privyAuthenticated) {
      // Access token is available through getAccessToken
      try {
        const privy = (window as any).__privyInstance;
        if (privy?.getAccessToken) {
          privy.getAccessToken().then((token: string) => {
            (window as any).__privyAccessToken = token;
          });
        }
      } catch {}
    }
  }, [privyAuthenticated, isFarcaster]);

  // Auto sign-out when Privy session expires (non-Farcaster)
  useEffect(() => {
    if (!isFarcaster && privyReady && prevPrivyUserRef.current && !privyUser && user) {
      console.log('[WalletButton] Privy session expired, signing out');
      setIsManuallyDisconnected(true);
      signOut();
    }
    prevPrivyUserRef.current = privyUser;
  }, [privyUser, privyReady, isFarcaster, user, signOut]);

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

  // Auto sign-in after Privy login (non-Farcaster)
  // Use signInWithPrivy for social/email, signInWithWallet only for direct wallet login
  useEffect(() => {
    if (!isFarcaster && !user && !isManuallyDisconnected && privyUser) {
      if (isPrivySocialLogin(privyUser)) {
        // Social/email login — use Privy auth (no SIWE popup)
        setTimeout(() => {
          signInWithPrivy();
        }, 500);
      } else if (isConnected && address) {
        // Direct wallet login via Privy — use SIWE
        setTimeout(() => {
          signInWithWallet();
        }, 500);
      }
    }
  }, [isFarcaster, isConnected, address, user, isManuallyDisconnected, privyUser, signInWithWallet, signInWithPrivy]);
  
  const handleDisconnect = async () => {
    try {
      setIsManuallyDisconnected(true);
      await signOut();
      if (!isFarcaster) {
        try { await privyLogout(); } catch {}
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
    } else {
      if (!privyUser) {
        privyLogin();
      }
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
  
  // Regular browser — Privy
  if (!privyUser || isManuallyDisconnected) {
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

  if (!user) {
    // Auth is in progress (Privy or SIWE)
    return (
      <button
        disabled
        type="button"
        className="px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg font-semibold bg-gradient-uds text-white opacity-70 shadow-md transition-all duration-200 flex items-center gap-1 sm:gap-2 text-xs sm:text-sm h-8 sm:h-9"
      >
        <LogIn className="h-3 w-3 sm:h-4 sm:w-4 animate-pulse" />
        <span>Signing in...</span>
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
