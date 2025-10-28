import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Wallet } from 'lucide-react';
import { useDisconnect, useConnect, useAccount } from 'wagmi';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export function WalletConnectButton() {
  const { disconnect } = useDisconnect();
  const { connect, connectors } = useConnect();
  const { address, isConnected, chain } = useAccount();
  const { signOut, isFarcaster } = useAuth();
  
  const handleDisconnect = async () => {
    try {
      await signOut();
      disconnect();
    } catch (error) {
      console.error('Disconnect error:', error);
      disconnect();
    }
  };

  const handleFarcasterConnect = async () => {
    try {
      toast.info('Подключение кошелька...');
      
      const farcasterConnector = connectors.find(c => c.id === 'farcaster');
      
      if (farcasterConnector) {
        toast.info(`Используется Farcaster connector`);
        await connect({ connector: farcasterConnector });
        toast.success('Кошелек подключен!');
      } else {
        toast.warning(`Farcaster connector не найден, используется ${connectors[0]?.name || 'первый доступный'}`);
        await connect({ connector: connectors[0] });
        toast.success('Кошелек подключен!');
      }
    } catch (error: any) {
      console.error('Farcaster connect error:', error);
      toast.error(`Ошибка подключения: ${error.message || 'Неизвестная ошибка'}`);
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
