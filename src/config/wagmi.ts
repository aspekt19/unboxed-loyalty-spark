import { createConfig as createWagmiConfig } from 'wagmi';
import { coinbaseWallet, injected } from 'wagmi/connectors';
import { base } from 'wagmi/chains';
import { http, fallback } from 'viem';
import { farcasterMiniApp } from '@farcaster/miniapp-wagmi-connector';
import { createCDPEmbeddedWalletConnector } from '@coinbase/cdp-wagmi';
import { cdpConfig, isCdpEnabled } from '@/config/cdp';

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

// Heuristic: are we inside an embedded webview / iframe (Base App, Farcaster,
// Warpcast, in-app browsers)? Used only to decide how long we may wait for the
// miniapp handshake before falling back to the regular browser providers.
export function isEmbeddedWebview(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (window.parent && window.parent !== window) return true;
    if ((window as unknown as { ReactNativeWebView?: unknown }).ReactNativeWebView) return true;
    const ua = navigator.userAgent || '';
    return /Warpcast|Farcaster|BaseApp|Coinbase/i.test(ua);
  } catch {
    // Cross-origin access to window.parent throws → we are framed.
    return true;
  }
}

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

// wagmi and the CDP connector may resolve different viem copies whose
// Transport types are nominally incompatible (identical at runtime). Cast once
// so all wagmi configs can share the same fallback transport.
const transports = { [base.id]: transport } as unknown as Record<number, never>;

// Farcaster config: standard wagmi with farcasterMiniApp connector
export const farcasterWagmiConfig = createWagmiConfig({
  chains: [base],
  transports,
  connectors: [farcasterMiniApp()],
  ssr: false,
});

export const CDP_CONNECTOR_ID = 'cdp-embedded-wallet';

/**
 * Regular browser: Coinbase embedded wallet (Google / email → gas-sponsored smart
 * account) + external wallets (MetaMask / browser wallet, Coinbase Wallet / Base App).
 */
export const browserWagmiConfig = createWagmiConfig({
  chains: [base],
  transports,
  connectors: [
    ...(isCdpEnabled
      ? [
          createCDPEmbeddedWalletConnector({
            cdpConfig,
            providerConfig: { chains: [base], transports: { [base.id]: http() } },
          }) as unknown as ReturnType<typeof injected>,
        ]
      : []),
    injected(),
    coinbaseWallet({ appName: 'Loyal Spark', appLogoUrl: 'https://loyalspark.online/new-favicon.png', preference: 'all' }),
  ],
  ssr: false,
});

export const config = isFarcasterContext() ? farcasterWagmiConfig : browserWagmiConfig;
