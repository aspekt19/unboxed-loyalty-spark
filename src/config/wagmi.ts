import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { base } from 'wagmi/chains';
import { http } from 'viem';

export const config = getDefaultConfig({
  appName: 'Loyal Spark',
  projectId: '2bf3fb72e7f66e63215bb32b7127f1bc', // Get from WalletConnect Cloud
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
