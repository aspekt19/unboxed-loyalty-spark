import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { createConfig } from 'wagmi';
import { base } from 'wagmi/chains';
import { http } from 'viem';
import { walletConnect } from 'wagmi/connectors';
import { farcasterMiniApp } from '@farcaster/miniapp-wagmi-connector';
import sdk from '@farcaster/frame-sdk';

// Initial sync check - more aggressive detection for Farcaster
const isFarcasterContext = () => {
  if (typeof window === 'undefined') return false;
  
  try {
    const url = window.location.href;
    const userAgent = navigator.userAgent;
    
    console.log('Checking Farcaster context:', { url, userAgent });
    
    // Check URL patterns
    if (url.includes('warpcast.com') || url.includes('farcaster://')) {
      console.log('Farcaster detected via URL');
      return true;
    }
    
    // Check user agent
    if (userAgent.includes('Farcaster')) {
      console.log('Farcaster detected via user agent');
      return true;
    }
    
    // Check if running in iframe (Farcaster frames run in iframes)
    if (window.self !== window.top) {
      console.log('Farcaster detected via iframe');
      return true;
    }
    
    console.log('Not in Farcaster context');
    return false;
  } catch (error) {
    console.error('Error detecting Farcaster:', error);
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
      connectors: [
        farcasterMiniApp(),
        walletConnect({
          projectId: '2bf3fb72e7f66e63215bb32b7127f1bc',
          showQrModal: false,
          qrModalOptions: {
            enableExplorer: false,
          },
          metadata: {
            name: 'Loyal Spark',
            description: 'Decentralized Loyalty Rewards',
            url: 'https://loyalspark.online',
            icons: ['https://loyalspark.online/new-favicon.png'],
          },
        }),
      ],
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
