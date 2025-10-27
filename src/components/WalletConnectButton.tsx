import { Wallet } from 'lucide-react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { useAuth } from '@/contexts/AuthContext';

export function WalletConnectButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { signOut } = useAuth();
  
  const handleDisconnect = async () => {
    try {
      await signOut();
      disconnect();
    } catch (error) {
      console.error('Disconnect error:', error);
      disconnect();
    }
  };

  const handleConnect = () => {
    if (connectors[0]) {
      connect({ connector: connectors[0] });
    }
  };

  if (!isConnected) {
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
    <div className="flex gap-1.5">
      <button
        onClick={handleDisconnect}
        type="button"
        className="px-3 py-1.5 rounded-lg font-semibold text-background bg-foreground hover:bg-foreground/90 transition-all duration-200"
      >
        <span className="text-xs">
          {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Connected'}
        </span>
      </button>
    </div>
  );
}
