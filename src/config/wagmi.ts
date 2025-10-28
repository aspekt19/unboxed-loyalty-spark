import { createConfig } from 'wagmi';
import { base } from 'wagmi/chains';
import { http } from 'viem';
import { injected, walletConnect, coinbaseWallet, safe } from 'wagmi/connectors';
import { farcasterMiniApp } from '@farcaster/miniapp-wagmi-connector';

const transport = http('https://base-rpc.publicnode.com', {
  batch: false,
  retryCount: 5,
  retryDelay: 1000,
});

// Hybrid config supporting both web (RainbowKit) and Farcaster miniapp
export const config = createConfig({
  chains: [base],
  transports: {
    [base.id]: transport,
  },
  connectors: [
    // Farcaster connector for miniapp context
    farcasterMiniApp(),
    // Standard web3 connectors for web context
    injected({ shimDisconnect: true }),
    walletConnect({
      projectId: '2bf3fb72e7f66e63215bb32b7127f1bc',
      showQrModal: true,
      metadata: {
        name: 'Loyal Spark',
        description: 'Decentralized Loyalty Rewards',
        url: 'https://loyalspark.online',
        icons: ['https://loyalspark.online/new-favicon.png'],
      },
    }),
    coinbaseWallet({
      appName: 'Loyal Spark',
      appLogoUrl: 'https://loyalspark.online/new-favicon.png',
    }),
    safe(),
  ],
  ssr: false,
});

export const rainbowKitLocale = 'en';
