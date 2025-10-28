import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Wallet } from 'lucide-react';
import { useConnect, useAccount, useDisconnect } from 'wagmi';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useEffect, useRef } from 'react';

export function WalletConnectButton() {
  const { disconnect: wagmiDisconnect } = useDisconnect();
  const { connect, connectors } = useConnect();
  const { address, isConnected } = useAccount();
  const { signOut, isFarcaster } = useAuth();
  const wasConnected = useRef(isConnected);
  const isDisconnecting = useRef(false);
  
  // Override wagmi disconnect to add signOut
  const disconnect = () => {
    if (isDisconnecting.current) return;
    
    isDisconnecting.current = true;
    console.log('Custom disconnect called');
    
    signOut()
      .catch((err) => console.error('SignOut error:', err))
      .finally(() => {
        wagmiDisconnect();
        setTimeout(() => {
          isDisconnecting.current = false;
        }, 1000);
      });
  };
  
  // Track disconnection
  useEffect(() => {
    const justDisconnected = wasConnected.current === true && isConnected === false;
    
    if (justDisconnected && !isFarcaster && !isDisconnecting.current) {
      console.log('Wallet disconnected - cleaning up auth');
      signOut().catch((err) => console.error('SignOut error:', err));
    }
    
    wasConnected.current = isConnected;
  }, [isConnected, isFarcaster, signOut]);
  
  const handleDisconnect = async () => {
    disconnect();
  };

  const handleFarcasterConnect = async () => {
    try {
      console.log('Available connectors:', connectors.map(c => ({ id: c.id, name: c.name })));
      console.log('isFarcaster:', isFarcaster);
      
      toast.info('Connecting wallet...');
      
      const farcasterConnector = connectors.find(c => c.id === 'farcaster');
      
      if (farcasterConnector) {
        console.log('Found Farcaster connector, connecting...');
        await connect({ connector: farcasterConnector });
        toast.success('Wallet connected!');
      } else {
        console.error('Farcaster connector not found. Available:', connectors.map(c => c.id));
        toast.error('Farcaster wallet not found. Please try again.');
      }
    } catch (error: any) {
      console.error('Farcaster connect error:', error);
      toast.error(`Connection failed: ${error.message || 'Unknown error'}`);
    }
  };

  // Use simplified UI for Farcaster context
  if (isFarcaster) {
    if (!isConnected) {
      return (
        <button
          onClick={handleFarcasterConnect}
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
        className="px-3 py-1.5 rounded-lg font-semibold text-background bg-foreground hover:bg-foreground/90 transition-all duration-200"
      >
        <span className="text-xs">{address?.slice(0, 6)}...{address?.slice(-4)}</span>
      </button>
    );
  }
  
  // Use ConnectButton.Custom for web to intercept disconnect
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
                    onClick={() => {
                      console.log('Account button clicked - opening modal');
                      openAccountModal();
                    }}
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
