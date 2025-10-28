import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { createConfig } from 'wagmi';
import { base } from 'wagmi/chains';
import { http } from 'viem';
import { walletConnect } from 'wagmi/connectors';
import { farcasterMiniApp } from '@farcaster/miniapp-wagmi-connector';
import sdk from '@farcaster/frame-sdk';

// Detect if running inside Farcaster using SDK context
const isFarcasterContext = () => {
  if (typeof window === 'undefined') return false;
  try {
    // Check if SDK is initialized and has context
    const hasContext = sdk?.context && typeof sdk.context === 'object';
    return hasContext;
  } catch {
    return false;
  }
};

const transport = http('https://base-rpc.publicnode.com', {
  batch: false,
  retryCount: 5,
  retryDelay: 1000,
});

export const config = isFarcasterContext()
  ? createConfig({
      chains: [base],
      transports: {
        [base.id]: transport,
      },
      connectors: [
        farcasterMiniApp(),
        walletConnect({
          projectId: '2bf3fb72e7f66e63215bb32b7127f1bc',
          showQrModal: false,
          metadata: {
            name: 'Loyal Spark',
            description: 'Decentralized Loyalty Rewards',
            url: 'https://loyalspark.online',
            icons: ['https://loyalspark.online/new-favicon.png'],
          },
        }),
      ],
      ssr: false,
    })
  : getDefaultConfig({
      appName: 'Loyal Spark',
      projectId: '2bf3fb72e7f66e63215bb32b7127f1bc',
      chains: [base],
      transports: {
        [base.id]: transport,
      },
      ssr: false,
    });

export const rainbowKitLocale = 'en';
