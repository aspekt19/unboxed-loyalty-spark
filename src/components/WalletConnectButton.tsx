import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Wallet } from 'lucide-react';

export function WalletConnectButton() {
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
                    className="group relative px-6 py-3 rounded-xl font-semibold text-white transition-all duration-300 overflow-hidden flex items-center gap-2"
                    style={{ 
                      background: 'linear-gradient(135deg, hsl(270 100% 68%), hsl(320 100% 65%))',
                      boxShadow: '0 4px 20px rgba(168, 85, 247, 0.4)'
                    }}
                  >
                    <Wallet className="h-5 w-5 relative z-10" />
                    <span className="relative z-10">Connect Wallet</span>
                    <div className="absolute inset-0 bg-gradient-to-r from-accent to-primary opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  </button>
                );
              }

              if (chain.unsupported) {
                return (
                  <button
                    onClick={openChainModal}
                    type="button"
                    className="px-6 py-3 rounded-xl font-semibold text-white transition-all duration-300"
                    style={{ 
                      background: 'linear-gradient(135deg, hsl(0 85% 60%), hsl(20 85% 60%))',
                      boxShadow: '0 4px 20px rgba(239, 68, 68, 0.4)'
                    }}
                  >
                    Wrong network
                  </button>
                );
              }

              return (
                <div className="flex gap-3">
                  <button
                    onClick={openChainModal}
                    type="button"
                    className="group relative px-4 py-3 rounded-xl font-medium transition-all duration-300 flex items-center gap-2"
                    style={{
                      background: 'hsl(var(--card))',
                      border: '2px solid hsl(var(--border))',
                    }}
                  >
                    {chain.hasIcon && (
                      <div className="w-5 h-5 rounded-full overflow-hidden">
                        {chain.iconUrl && (
                          <img
                            alt={chain.name ?? 'Chain icon'}
                            src={chain.iconUrl}
                            className="w-5 h-5"
                          />
                        )}
                      </div>
                    )}
                    <span className="bg-gradient-to-r from-secondary to-accent bg-clip-text text-transparent font-semibold">
                      {chain.name}
                    </span>
                  </button>

                  <button
                    onClick={openAccountModal}
                    type="button"
                    className="group relative px-5 py-3 rounded-xl font-semibold text-white transition-all duration-300 overflow-hidden"
                    style={{ 
                      background: 'linear-gradient(135deg, hsl(270 100% 68%), hsl(320 100% 65%))',
                      boxShadow: '0 4px 20px rgba(168, 85, 247, 0.4)'
                    }}
                  >
                    <span className="relative z-10">{account.displayName}</span>
                    <div className="absolute inset-0 bg-gradient-to-r from-accent to-primary opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
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
