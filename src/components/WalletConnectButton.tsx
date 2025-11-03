import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Wallet } from 'lucide-react';
import { useDisconnect, useConnect, useAccount } from 'wagmi';
import { useAuth } from '@/contexts/AuthContext';
import { sdk } from '@farcaster/miniapp-sdk';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useState, useEffect } from 'react';

// Detect if running inside Farcaster using SDK actions
const isFarcasterContext = () => {
  if (typeof window === 'undefined') return false;
  try {
    // Check if SDK is initialized by checking for actions object
    const hasSDK = sdk?.actions && typeof sdk.actions === 'object';
    console.log('[Farcaster Detection]', { hasSDK, sdk: !!sdk, actions: !!sdk?.actions });
    return hasSDK;
  } catch (error) {
    console.error('[Farcaster Detection Error]', error);
    return false;
  }
};

export function WalletConnectButton() {
  const { disconnect } = useDisconnect();
  const { connect, connectors } = useConnect();
  const { address, isConnected, chain } = useAccount();
  const { signOut } = useAuth();
  const [farcasterUser, setFarcasterUser] = useState<{
    username?: string;
    displayName?: string;
    pfpUrl?: string;
  } | null>(null);
  
  useEffect(() => {
    const loadFarcasterUser = async () => {
      console.log('[WalletButton] isFarcasterContext:', isFarcasterContext());
      if (isFarcasterContext()) {
        try {
          console.log('[WalletButton] Calling SDK ready...');
          // Ensure SDK is ready first
          await sdk.actions.ready();
          console.log('[WalletButton] SDK ready, loading context...');
          
          // Wait for Farcaster context to load
          const context = await sdk.context;
          console.log('[WalletButton] Farcaster context loaded:', context);
          console.log('[WalletButton] Context user:', context?.user);
          
          if (context?.user) {
            const userData = {
              username: context.user.username,
              displayName: context.user.displayName,
              pfpUrl: context.user.pfpUrl,
            };
            console.log('[WalletButton] Setting Farcaster user data:', userData);
            setFarcasterUser(userData);
          } else {
            console.warn('[WalletButton] Farcaster context loaded but no user data found');
          }
        } catch (error) {
          console.error('[WalletButton] Failed to load Farcaster user:', error);
        }
      } else {
        console.log('[WalletButton] Not in Farcaster context');
      }
    };
    
    loadFarcasterUser();
  }, []);
  
  const handleDisconnect = async () => {
    try {
      await signOut();
      disconnect();
    } catch (error) {
      console.error('Disconnect error:', error);
      disconnect();
    }
  };

  // Use simplified UI for Farcaster context
  if (isFarcasterContext()) {
    if (!isConnected) {
      return (
        <button
          onClick={() => connect({ connector: connectors[0] })}
          type="button"
          className="px-5 py-2.5 rounded-lg font-semibold text-background bg-foreground hover:bg-foreground/90 transition-all duration-200 flex items-center gap-2"
        >
          <Wallet className="h-4 w-4" />
          <span>Connect Wallet</span>
        </button>
      );
    }

    return (
      <button
        onClick={handleDisconnect}
        type="button"
        className="px-3 py-2 rounded-lg font-semibold text-background bg-foreground hover:bg-foreground/90 transition-all duration-200 flex items-center gap-2"
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
  
  // Use RainbowKit UI for web
  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        mounted,
      }) => {
        const ready = mounted;
        const connected = ready && account && chain;

        return (
          <div
            {...(!ready && {
              'aria-hidden': true,
              style: {
                opacity: 0,
                pointerEvents: 'none',
                userSelect: 'none',
              },
            })}
          >
            {(() => {
              if (!connected) {
                return (
                  <button
                    onClick={openConnectModal}
                    type="button"
                    className="px-5 py-2.5 rounded-lg font-semibold text-background bg-foreground hover:bg-foreground/90 transition-all duration-200 flex items-center gap-2"
                  >
                    <Wallet className="h-4 w-4" />
                    <span>Connect Wallet</span>
                  </button>
                );
              }

              if (chain.unsupported) {
                return (
                  <button
                    onClick={openChainModal}
                    type="button"
                    className="px-5 py-2.5 rounded-lg font-semibold text-background bg-destructive hover:bg-destructive/90 transition-all duration-200"
                  >
                    Wrong network
                  </button>
                );
              }

              return (
                <div className="flex gap-1.5">
                  <button
                    onClick={openChainModal}
                    type="button"
                    className="px-2 py-1.5 rounded-lg font-medium transition-all duration-200 flex items-center gap-1.5 border border-border hover:bg-secondary"
                  >
                    {chain.hasIcon && (
                      <div className="w-3.5 h-3.5 rounded-full overflow-hidden">
                        {chain.iconUrl && (
                          <img
                            alt={chain.name ?? 'Chain icon'}
                            src={chain.iconUrl}
                            className="w-3.5 h-3.5"
                          />
                        )}
                      </div>
                    )}
                    <span className="text-foreground text-xs font-semibold">
                      {chain.name}
                    </span>
                  </button>

                  <button
                    onClick={openAccountModal}
                    type="button"
                    className="px-3 py-1.5 rounded-lg font-semibold text-background bg-foreground hover:bg-foreground/90 transition-all duration-200"
                  >
                    <span className="text-xs">{account.displayName}</span>
                  </button>
                </div>
              );
            })()}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}
