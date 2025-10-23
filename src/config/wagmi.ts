import { getDefaultConfig, connectorsForWallets, type Wallet, getWalletConnectConnector } from '@rainbow-me/rainbowkit';
import { base } from 'wagmi/chains';
import { http } from 'viem';
import { 
  injectedWallet, 
  coinbaseWallet,
  walletConnectWallet 
} from '@rainbow-me/rainbowkit/wallets';

const appName = 'Loyal Spark';
const projectId = '2bf3fb72e7f66e63215bb32b7127f1bc';

// Кастомный MetaMask с deep link для мобильных устройств
const metaMaskMobile = (): Wallet => ({
  id: 'metamask',
  name: 'MetaMask',
  iconUrl: 'https://assets.metamask.io/images/mm-logo.svg',
  iconBackground: '#fff',
  downloadUrls: {
    android: 'https://play.google.com/store/apps/details?id=io.metamask',
    ios: 'https://apps.apple.com/app/metamask/id1438144202',
  },
  mobile: {
    getUri: (uri: string) => `https://metamask.app.link/wc?uri=${encodeURIComponent(uri)}`,
  },
  qrCode: {
    getUri: (uri: string) => uri,
  },
  createConnector: getWalletConnectConnector({ projectId }),
});

const connectors = connectorsForWallets(
  [
    {
      groupName: 'Recommended',
      wallets: [
        injectedWallet,    // Приоритет: Farcaster Browser Wallet / MetaMask extension на десктопе
        coinbaseWallet,    // Base Wallet / Coinbase Wallet
        metaMaskMobile,    // MetaMask с deep link (без QR)
        walletConnectWallet, // Другие кошельки
      ],
    },
  ],
  { appName, projectId }
);

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
  connectors,
  ssr: false,
});

export const rainbowKitLocale = 'en';
