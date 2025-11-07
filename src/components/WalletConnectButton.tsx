import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Wallet } from 'lucide-react';
import { useDisconnect, useConnect, useAccount } from 'wagmi';
import { useAuth } from '@/contexts/AuthContext';
import { sdk } from '@farcaster/miniapp-sdk';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useState, useEffect } from 'react';

// Detect if running inside Farcaster miniapp
const isFarcasterContext = () => {
  if (typeof window === 'undefined') return false;
  try {
    // Only use explicit signals, not SDK context (which can be present in web version)
    const urlParams = new URLSearchParams(window.location.search);
    const hasFarcasterParam = urlParams.has('farcaster') || urlParams.has('fc');
    const isFarcasterPath = window.location.pathname.includes('/frame');
    const hasFarcasterUA = /farcaster/i.test(navigator.userAgent);
    
    const isFarcaster = hasFarcasterParam || isFarcasterPath || hasFarcasterUA;
    console.log('[Farcaster Detection]', { 
      isFarcaster,
      hasFarcasterParam,
      isFarcasterPath, 
      hasFarcasterUA,
      pathname: window.location.pathname,
      search: window.location.search
    });
    return isFarcaster;
  } catch (error) {
    console.error('[Farcaster Detection Error]', error);
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
  
  useEffect(() => {
    const loadFarcasterUser = async () => {
      const isFC = isFarcasterContext();
      console.log('[WalletButton] useEffect - isFarcasterContext:', isFC);
      
      if (!isFC) {
        return;
      }

      try {
        console.log('[WalletButton] Loading Farcaster context...');
        const context = await sdk.context;
        console.log('[WalletButton] Farcaster context:', context);
        console.log('[WalletButton] Context user:', context?.user);
        
        if (context?.user) {
          const userData = {
            username: context.user.username,
            displayName: context.user.displayName,
            pfpUrl: context.user.pfpUrl,
          };
          console.log('[WalletButton] Setting farcasterUser:', userData);
          setFarcasterUser(userData);
        } else {
          console.warn('[WalletButton] No user data in context');
        }
      } catch (error) {
        console.error('[WalletButton] Failed to load Farcaster user:', error);
      }
    };
    
    loadFarcasterUser();
  }, []);
  
  const handleDisconnect = async () => {
    try {
      console.log('[WalletButton] handleDisconnect called');
      console.log('[WalletButton] Current state:', { isConnected, address, user: !!user });
      
      // Устанавливаем флаг ручного отключения для UI
      setIsManuallyDisconnected(true);
      
      // Выходим из Supabase
      await signOut();
      console.log('[WalletButton] Supabase signOut completed');
      
      // В Farcaster контексте кошелек нельзя отключить полностью,
      // но мы скрываем его в UI через флаг isManuallyDisconnected
    } catch (error) {
      console.error('[WalletButton] Disconnect error:', error);
    }
  };
  
  const handleConnect = () => {
    console.log('[WalletButton] Connect wallet clicked');
    
    // Сбрасываем флаг ручного отключения
    setIsManuallyDisconnected(false);
    
    // Сбрасываем флаг выхода в AuthContext - это позволит автоматическому входу сработать
    resetManualSignOut();
    
    // Подключаем кошелек (в Farcaster контексте это быстро вернет существующее соединение)
    connect({ connector: connectors[0] });
  };

  // Use simplified UI for Farcaster context
  if (isFarcasterContext()) {
    console.log('[WalletButton] Rendering Farcaster UI', { 
      isConnected, 
      address: address?.slice(0, 10), 
      farcasterUser, 
      isManuallyDisconnected,
      hasFarcasterData: !!farcasterUser,
      displayName: farcasterUser?.displayName,
      username: farcasterUser?.username
    });
    
    // Показываем кнопку Connect если пользователь вышел вручную
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
        onClick={() => {
          console.log('[WalletButton] Disconnect clicked in Farcaster UI');
          handleDisconnect();
        }}
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
