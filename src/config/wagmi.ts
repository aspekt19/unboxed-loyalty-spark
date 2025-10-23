import { http } from 'viem';
import { base } from 'wagmi/chains';
import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { 
  injectedWallet,
  coinbaseWallet,
  metaMaskWallet,
  walletConnectWallet 
} from '@rainbow-me/rainbowkit/wallets';

const appName = 'Loyal Spark';
const projectId = '2bf3fb72e7f66e63215bb32b7127f1bc';

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
  wallets: [
    {
      groupName: 'Recommended',
      wallets: [
        injectedWallet,      // ПРИОРИТЕТ: Farcaster встроенный кошелек в Warpcast / MetaMask extension на веб
        coinbaseWallet,      // Base Wallet / Coinbase Wallet
        metaMaskWallet,      // MetaMask (с deep links на мобильных)
        walletConnectWallet, // WalletConnect (другие кошельки)
      ],
    },
  ],
  ssr: false,
});

export const rainbowKitLocale = 'en';
