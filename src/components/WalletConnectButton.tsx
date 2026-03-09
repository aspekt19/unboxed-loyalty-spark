import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Wallet, Smartphone } from 'lucide-react';
import { useDisconnect, useConnect, useAccount } from 'wagmi';
import { useAuth } from '@/contexts/AuthContext';
import { sdk } from '@farcaster/miniapp-sdk';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useState, useEffect } from 'react';

/** Detect if user is on mobile device */
const isMobileDevice = () => {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

/** Detect if running inside Farcaster miniapp */
const isFarcasterContext = () => {
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

export function WalletConnectButton() {
  const { disconnect } = useDisconnect();
  const { connect, connectors } = useConnect();
  const { address, isConnected, chain } = useAccount();
  const { signOut, signInWithWallet, resetManualSignOut, user } = useAuth();
  const [isManuallyDisconnected, setIsManuallyDisconnected] = useState(false);
  const [farcasterUser, setFarcasterUser] = useState<{
    username?: string;
    displayName?: string;
    pfpUrl?: string;
  } | null>(null);
  const [isMobileWalletDialogOpen, setIsMobileWalletDialogOpen] = useState(false);

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
    if (isFarcasterContext() && !isConnected && !isManuallyDisconnected && connectors.length > 0) {
      setTimeout(() => {
        connect({ connector: connectors[0] });
      }, 500);
    }
  }, [connectors.length]);
  
  // Auto sign-in on reconnect in Farcaster
  useEffect(() => {
    if (isFarcasterContext() && isConnected && address && !isManuallyDisconnected) {
      setTimeout(() => {
        signInWithWallet();
      }, 300);
    }
  }, [isConnected, address, isManuallyDisconnected, signInWithWallet]);
  
  const handleDisconnect = async () => {
    try {
      setIsManuallyDisconnected(true);
      await signOut();
    } catch (error) {
      console.error('[WalletButton] Disconnect error:', error);
    }
  };
  
  const handleConnect = async () => {
    setIsManuallyDisconnected(false);
    resetManualSignOut();
    connect({ connector: connectors[0] });
    
    if (isFarcasterContext() && isConnected && address) {
      setTimeout(() => {
        signInWithWallet();
      }, 300);
    }
  };

  // Farcaster UI
  if (farcasterUser) {
    if (!isConnected || isManuallyDisconnected) {
      return (
        <button
          onClick={handleConnect}
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
  
  // RainbowKit UI for web
  return (
    <>
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

          const handleOpenConnect = () => {
            if (isMobileDevice()) {
              setIsMobileWalletDialogOpen(true);
            } else {
              openConnectModal();
            }
          };

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
                      onClick={handleOpenConnect}
                      type="button"
                      className="px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg font-semibold bg-gradient-uds text-white hover:opacity-90 shadow-md hover:shadow-lg transition-all duration-200 flex items-center gap-1 sm:gap-2 text-xs sm:text-sm h-8 sm:h-9"
                    >
                      <Wallet className="h-3 w-3 sm:h-4 sm:w-4" />
                      <span>Connect</span>
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
                      className="px-2 py-1.5 rounded-lg font-medium transition-all duration-200 flex items-center gap-1.5 border-2 border-primary/30 hover:bg-uds-lavender hover:border-primary"
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
                      className="px-4 py-1.5 rounded-lg font-bold bg-uds-purple text-white hover:bg-uds-purple-light shadow-md hover:shadow-lg transition-all duration-200"
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

      <Dialog open={isMobileWalletDialogOpen} onOpenChange={setIsMobileWalletDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Connect wallet</DialogTitle>
            <DialogDescription>
              Choose a wallet installed on your phone or use WalletConnect.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-2">
            {connectors.map((connector) => (
              <button
                key={connector.id}
                type="button"
                onClick={async () => {
                  try {
                    await connect({ connector });
                    setIsMobileWalletDialogOpen(false);
                  } catch (error) {
                    console.error('[WalletButton] Mobile wallet connect error', error);
                  }
                }}
                className="w-full px-3 py-2 rounded-lg border border-primary/30 flex items-center justify-between text-sm font-medium hover:bg-uds-lavender hover:border-primary transition-colors"
              >
                <span>{connector.name}</span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
