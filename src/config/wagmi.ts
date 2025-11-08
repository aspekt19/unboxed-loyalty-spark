import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { createConfig } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';
import { http, custom } from 'viem';
import { farcasterMiniApp } from '@farcaster/miniapp-wagmi-connector';
import { sdk } from '@farcaster/miniapp-sdk';
import { createRoundUpTransport } from '@/lib/roundUpTransport';

// Detect if running inside Farcaster miniapp
const isFarcasterContext = () => {
  if (typeof window === 'undefined') return false;
  try {
    // Only use explicit signals, not SDK context (which can be present in web version)
    const urlParams = new URLSearchParams(window.location.search);
    const hasFarcasterParam = urlParams.has('farcaster') || urlParams.has('fc');
    const isFarcasterPath = window.location.pathname.includes('/frame');
    const hasFarcasterUA = /farcaster/i.test(navigator.userAgent);
    
    return hasFarcasterParam || isFarcasterPath || hasFarcasterUA;
  } catch {
    return false;
  }
};

const transport = http('https://sepolia.base.org', {
  batch: false,
  retryCount: 5,
  retryDelay: 1000,
});

// Создаем транспорт с автоматическим round-up для MetaMask
const getRoundUpTransport = () => {
  if (typeof window !== 'undefined' && window.ethereum) {
    return createRoundUpTransport(window.ethereum);
  }
  return transport;
};

export const config = isFarcasterContext()
  ? createConfig({
      chains: [baseSepolia],
      transports: {
        [baseSepolia.id]: transport,
      },
      connectors: [farcasterMiniApp()],
      ssr: false,
    })
  : getDefaultConfig({
      appName: 'Loyal Spark',
      projectId: '2bf3fb72e7f66e63215bb32b7127f1bc',
      chains: [baseSepolia],
      transports: {
        [baseSepolia.id]: getRoundUpTransport(),
      },
      ssr: false,
    });

export const rainbowKitLocale = 'en';
