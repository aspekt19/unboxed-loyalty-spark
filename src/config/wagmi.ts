import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { createConfig } from 'wagmi';
import { base } from 'wagmi/chains';
import { http } from 'viem';
import { farcasterMiniApp } from '@farcaster/miniapp-wagmi-connector';
import { injected } from 'wagmi/connectors';

const transport = http('https://base-rpc.publicnode.com', {
  batch: false,
  retryCount: 5,
  retryDelay: 1000,
});

// Create config with both Farcaster and standard connectors
export const config = createConfig({
  chains: [base],
  transports: {
    [base.id]: transport,
  },
  connectors: [
    farcasterMiniApp(),
    injected(),
  ],
  ssr: false,
});

export const rainbowKitLocale = 'en';
