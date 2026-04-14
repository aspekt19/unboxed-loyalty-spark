import { createConfig as createWagmiConfig } from 'wagmi';
import { createConfig as createPrivyWagmiConfig } from '@privy-io/wagmi';
import { base } from 'wagmi/chains';
import { http } from 'viem';
import { farcasterMiniApp } from '@farcaster/miniapp-wagmi-connector';

// Detect if running inside Farcaster miniapp
export const isFarcasterContext = () => {
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

const transport = http('https://base-rpc.publicnode.com', {
  batch: false,
  retryCount: 5,
  retryDelay: 1000,
});

// Farcaster config: standard wagmi with farcasterMiniApp connector
export const farcasterWagmiConfig = createWagmiConfig({
  chains: [base],
  transports: {
    [base.id]: transport,
  },
  connectors: [farcasterMiniApp()],
  ssr: false,
  // Suppress reconnect errors when a previously used connector is unavailable
  reconnectOnMount: true,
});

// Privy wagmi config: used for regular browser (Privy manages connectors)
export const privyWagmiConfig = createPrivyWagmiConfig({
  chains: [base],
  transports: {
    [base.id]: transport,
  },
});

// Legacy export for backward compatibility
export const config = isFarcasterContext() ? farcasterWagmiConfig : privyWagmiConfig;

export const rainbowKitLocale = 'en'; // Legacy export, kept for backward compatibility
