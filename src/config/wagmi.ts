import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { createConfig } from 'wagmi';
import { base } from 'wagmi/chains';
import { http } from 'viem';
import { farcasterMiniApp } from '@farcaster/miniapp-wagmi-connector';
import { walletConnect, injected, coinbaseWallet } from 'wagmi/connectors';

const transport = http('https://base-rpc.publicnode.com', {
  batch: false,
  retryCount: 5,
  retryDelay: 1000,
});

// Create config with Farcaster, WalletConnect, Coinbase and other wallets
export const config = createConfig({
  chains: [base],
  transports: {
    [base.id]: transport,
  },
  connectors: [
    farcasterMiniApp(),
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
      preference: 'smartWalletOnly',
    }),
    injected(),
  ],
  ssr: false,
});

export const rainbowKitLocale = 'en';
