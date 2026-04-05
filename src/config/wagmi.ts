import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { coinbaseWallet, metaMaskWallet, walletConnectWallet, injectedWallet } from '@rainbow-me/rainbowkit/wallets';
import { createConfig } from 'wagmi';
import { base } from 'wagmi/chains';
import { http } from 'viem';
import { farcasterMiniApp } from '@farcaster/miniapp-wagmi-connector';

// Detect if running inside Farcaster miniapp
const isFarcasterContext = () => {
  if (typeof window === 'undefined') return false;
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const hasFarcasterParam = urlParams.has('farcaster') || urlParams.has('fc');
    const isFarcasterPath = window.location.pathname.includes('/frame');
    const hasFarcasterUA = /farcaster/i.test(navigator.userAgent);

    return hasFarcasterParam || isFarcasterPath || hasFarcasterUA;
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
      wallets: [
        {
          groupName: 'Recommended',
          wallets: [
            // Coinbase Smart Wallet first — supports email/passkey sign-in
            coinbaseWallet,
          ],
        },
        {
          groupName: 'Other wallets',
          wallets: [metaMaskWallet, walletConnectWallet, injectedWallet],
        },
      ],
      ssr: false,
    });

export const rainbowKitLocale = 'en';
