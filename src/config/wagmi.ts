import { createConfig, http } from 'wagmi';
import { base } from 'wagmi/chains';
import { farcasterMiniApp } from '@farcaster/miniapp-wagmi-connector';

// For Farcaster Mini Apps, use the special miniapp connector
// This enables native wallet integration including external wallets like MetaMask
export const config = createConfig({
  chains: [base],
  transports: {
    [base.id]: http('https://base-rpc.publicnode.com', {
      batch: false,
      retryCount: 5,
      retryDelay: 1000,
    }),
  },
  connectors: [
    farcasterMiniApp()
  ],
});
