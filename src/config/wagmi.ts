import { createConfig as createWagmiConfig } from 'wagmi';
import { createConfig as createPrivyWagmiConfig } from '@privy-io/wagmi';
import { injected } from 'wagmi/connectors';
import { base } from 'wagmi/chains';
import { http, fallback } from 'viem';
import { farcasterMiniApp } from '@farcaster/miniapp-wagmi-connector';

declare global {
  interface Window {
    __LOYALSPARK_CONFIRMED_MINIAPP__?: boolean;
  }
}

const FARCASTER_DETECTION_TIMEOUT_MS = 250;

function hasExplicitFarcasterHint(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.has('farcaster') || urlParams.has('fc') || window.location.pathname.includes('/frame');
  } catch {
    return false;
  }
}

// Detect if running inside a confirmed Farcaster/Base miniapp context.
// Do not rely on user-agent alone: BaseApp's in-app browser can include
// Farcaster markers even for normal web pages, which causes false positives.
export const isFarcasterContext = () => {
  if (typeof window === 'undefined') return false;
  return window.__LOYALSPARK_CONFIRMED_MINIAPP__ === true || hasExplicitFarcasterHint();
};

export async function detectFarcasterMiniApp(timeoutMs = FARCASTER_DETECTION_TIMEOUT_MS): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (window.__LOYALSPARK_CONFIRMED_MINIAPP__ === true) return true;

  try {
    const { sdk } = await import('@farcaster/miniapp-sdk');
    const isMiniApp = typeof sdk.isInMiniApp === 'function'
      ? await Promise.race<boolean>([
          sdk.isInMiniApp(),
          new Promise<boolean>((resolve) => {
            window.setTimeout(() => resolve(false), timeoutMs);
          }),
        ]).catch(() => false)
      : await Promise.race<boolean>([
          sdk.context.then((context) => Boolean(context?.client?.clientFid)),
          new Promise<boolean>((resolve) => {
            window.setTimeout(() => resolve(false), timeoutMs);
          }),
        ]).catch(() => false);

    if (isMiniApp) {
      window.__LOYALSPARK_CONFIRMED_MINIAPP__ = true;
    }

    return Boolean(isMiniApp);
  } catch {
    return false;
  }
}

// Multiple Base RPC providers: publicnode started rejecting some methods,
// so reads must fail over instead of breaking the whole UI.
const BASE_RPC_URLS = [
  'https://mainnet.base.org',
  'https://base.drpc.org',
  'https://base.meowrpc.com',
  'https://1rpc.io/base',
  'https://base-rpc.publicnode.com',
];

const transport = fallback(
  BASE_RPC_URLS.map((url) => http(url, { batch: false, retryCount: 2, retryDelay: 1000 })),
);

// Farcaster config: standard wagmi with farcasterMiniApp connector
export const farcasterWagmiConfig = createWagmiConfig({
  chains: [base],
  transports: {
    [base.id]: transport,
  },
  connectors: [farcasterMiniApp()],
  ssr: false,
});

// Privy wagmi config: used for regular browser (Privy manages connectors)
export const privyWagmiConfig = createPrivyWagmiConfig({
  chains: [base],
  transports: {
    [base.id]: transport,
  },
});

// Preview fallback: render the app even if Privy iframe init fails inside Lovable preview.
export const browserPreviewWagmiConfig = createWagmiConfig({
  chains: [base],
  transports: {
    [base.id]: transport,
  },
  connectors: [injected()],
  ssr: false,
});

// Legacy export for backward compatibility
export const config = isFarcasterContext() ? farcasterWagmiConfig : privyWagmiConfig;

export const rainbowKitLocale = 'en'; // Legacy export, kept for backward compatibility
