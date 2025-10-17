import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { base } from 'wagmi/chains';
import { http } from 'viem';

export const config = getDefaultConfig({
  appName: 'Loyal Spark',
  projectId: 'YOUR_PROJECT_ID', // Get from WalletConnect Cloud
  chains: [base],
  transports: {
    [base.id]: http('https://base-rpc.publicnode.com', {
      batch: false,
      retryCount: 5,
      retryDelay: 1000,
    }),
  },
  ssr: false,
});

export const rainbowKitLocale = 'en';
