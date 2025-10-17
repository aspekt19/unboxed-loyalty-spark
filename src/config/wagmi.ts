import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { base } from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'Loyal Spark',
  projectId: 'YOUR_PROJECT_ID', // Get from WalletConnect Cloud
  chains: [base],
  ssr: false,
});

export const rainbowKitLocale = 'en';
