import { http } from 'viem';
import { base } from 'wagmi/chains';
import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import {
  injectedWallet,
  coinbaseWallet,
  metaMaskWallet,
  walletConnectWallet,
} from '@rainbow-me/rainbowkit/wallets';

const appName = 'Loyal Spark';
const projectId = '2bf3fb72e7f66e63215bb32b7127f1bc';

const isWarpcast =
  typeof window !== 'undefined' && /Warpcast|Farcaster/i.test(navigator.userAgent);

export const config = getDefaultConfig({
  appName,
  projectId,
  chains: [base],
  transports: {
    [base.id]: http('https://base-rpc.publicnode.com', {
      batch: false,
      retryCount: 5,
      retryDelay: 1000,
    }),
  },
  wallets: isWarpcast
    ? [
        {
          groupName: 'Recommended',
          wallets: [injectedWallet, coinbaseWallet],
        },
      ]
    : [
        {
          groupName: 'Recommended',
          wallets: [injectedWallet, coinbaseWallet, metaMaskWallet, walletConnectWallet],
        },
      ],
  ssr: false,
});

export const rainbowKitLocale = 'en';
