import { http, createConfig } from 'wagmi';
import { base } from 'wagmi/chains';
import { connectorsForWallets } from '@rainbow-me/rainbowkit';
import { 
  coinbaseWallet,
  metaMaskWallet,
  walletConnectWallet 
} from '@rainbow-me/rainbowkit/wallets';
import { farcasterMiniApp } from '@farcaster/miniapp-wagmi-connector';

const appName = 'Loyal Spark';
const projectId = '2bf3fb72e7f66e63215bb32b7127f1bc';

// RainbowKit коннекторы для веб-версии (MetaMask, Coinbase, WalletConnect)
const rainbowKitConnectors = connectorsForWallets(
  [
    {
      groupName: 'Recommended',
      wallets: [
        coinbaseWallet,      // Coinbase Wallet / Base Wallet
        metaMaskWallet,      // MetaMask
        walletConnectWallet, // WalletConnect (другие кошельки)
      ],
    },
  ],
  { appName, projectId }
);

export const config = createConfig({
  chains: [base],
  transports: {
    [base.id]: http('https://base-rpc.publicnode.com', {
      batch: false,
      retryCount: 5,
      retryDelay: 1000,
    }),
  },
  // Гибридная конфигурация:
  // 1. Farcaster коннектор ПЕРВЫМ (автоподключение в Warpcast БЕЗ QR)
  // 2. RainbowKit коннекторы (для веб-версии с MetaMask, Coinbase, WalletConnect)
  connectors: [farcasterMiniApp(), ...rainbowKitConnectors],
});

export const rainbowKitLocale = 'en';
