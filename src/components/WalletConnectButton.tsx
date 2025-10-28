import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Wallet } from 'lucide-react';
import { useDisconnect, useConnect, useAccount } from 'wagmi';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useEffect, useRef } from 'react';

export function WalletConnectButton() {
  const { disconnect } = useDisconnect();
  const { connect, connectors } = useConnect();
  const { address, isConnected } = useAccount();
  const { signOut, isFarcaster } = useAuth();
  const wasConnected = useRef(isConnected);
  
  // Track disconnection and call signOut for web only
  useEffect(() => {
    if (wasConnected.current && !isConnected && !isFarcaster) {
      console.log('Wallet disconnected - cleaning up auth');
      signOut().catch((err) => console.error('SignOut error:', err));
    }
    wasConnected.current = isConnected;
  }, [isConnected, isFarcaster, signOut]);
  
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
  
  // Use standard RainbowKit button for web - handles disconnect automatically
  return <ConnectButton />;
}
