import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { createConfig } from 'wagmi';
import { base } from 'wagmi/chains';
import { http } from 'viem';
import { farcasterMiniApp } from '@farcaster/miniapp-wagmi-connector';
import { sdk } from '@farcaster/miniapp-sdk';

// Detect if running inside Farcaster using SDK actions
const isFarcasterContext = () => {
  if (typeof window === 'undefined') return false;
  try {
    // Check if SDK is initialized by checking for actions object
    const hasSDK = sdk?.actions && typeof sdk.actions === 'object';
    return hasSDK;
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
      connectors: [farcasterMiniApp()],
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
