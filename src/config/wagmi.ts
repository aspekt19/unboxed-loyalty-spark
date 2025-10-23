import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { base } from 'wagmi/chains';
import { http } from 'viem';
import { 
  injectedWallet, 
  metaMaskWallet,
  coinbaseWallet,
  walletConnectWallet 
} from '@rainbow-me/rainbowkit/wallets';

export const config = getDefaultConfig({
  appName: 'Loyal Spark',
  projectId: '2bf3fb72e7f66e63215bb32b7127f1bc',
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
        injectedWallet, // Обнаружит Warpcast/Farcaster встроенный кошелек
        coinbaseWallet, // Farcaster использует Coinbase Wallet
        metaMaskWallet, // Deep link для MetaMask
        walletConnectWallet, // Другие кошельки
      ],
    },
  ],
  ssr: false,
});

export const rainbowKitLocale = 'en';
