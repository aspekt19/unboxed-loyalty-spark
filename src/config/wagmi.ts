import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { base } from 'wagmi/chains';
import { http } from 'viem';

const transport = http('https://base-rpc.publicnode.com', {
  batch: false,
  retryCount: 5,
  retryDelay: 1000,
});

// RainbowKit config with full wallet selection including WalletConnect
export const config = getDefaultConfig({
  appName: 'Loyal Spark',
  projectId: '2bf3fb72e7f66e63215bb32b7127f1bc',
  chains: [base],
  transports: {
    [base.id]: transport,
  },
  ssr: false,
});

export const rainbowKitLocale = 'en';
