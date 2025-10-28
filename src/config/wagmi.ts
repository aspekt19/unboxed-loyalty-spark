import { createConfig } from 'wagmi';
import { base } from 'wagmi/chains';
import { http } from 'viem';
import { connectorsForWallets } from '@rainbow-me/rainbowkit';
import {
  metaMaskWallet,
  rainbowWallet,
  coinbaseWallet,
  walletConnectWallet,
  trustWallet,
  ledgerWallet,
  braveWallet,
  phantomWallet,
  argentWallet,
  safeWallet,
  zerionWallet,
  rabbyWallet,
} from '@rainbow-me/rainbowkit/wallets';
import { farcasterMiniApp } from '@farcaster/miniapp-wagmi-connector';

const transport = http('https://base-rpc.publicnode.com', {
  batch: false,
  retryCount: 5,
  retryDelay: 1000,
});

const projectId = '2bf3fb72e7f66e63215bb32b7127f1bc';

// Configure connectors with full wallet list + Farcaster
const connectors = connectorsForWallets(
  [
    {
      groupName: 'Popular',
      wallets: [
        metaMaskWallet,
        rainbowWallet,
        coinbaseWallet,
        walletConnectWallet,
        phantomWallet,
        trustWallet,
      ],
    },
    {
      groupName: 'Other',
      wallets: [
        braveWallet,
        ledgerWallet,
        argentWallet,
        safeWallet,
        zerionWallet,
        rabbyWallet,
      ],
    },
  ],
  {
    appName: 'Loyal Spark',
    projectId,
  }
);

// Add Farcaster connector manually
const allConnectors = [
  farcasterMiniApp(),
  ...connectors,
];

export const config = createConfig({
  chains: [base],
  transports: {
    [base.id]: transport,
  },
  connectors: allConnectors,
  ssr: false,
});

export const rainbowKitLocale = 'en';
