import type { PrivyClientConfig } from '@privy-io/react-auth';
import { base } from 'viem/chains';

export const PRIVY_APP_ID = 'cmnx59voy00f80bl5mtkn0n10';

export const privyConfig: PrivyClientConfig = {
  // Login methods available to users
  loginMethods: ['email', 'sms', 'google', 'wallet'],
  // Appearance
  appearance: {
    theme: 'light',
    accentColor: '#7C3AED',
    logo: '/placeholder.svg',
    showWalletLoginFirst: false,
    loginMessage: 'Sign in to Loyal Spark',
  },
  // Embedded wallets configuration
  embeddedWallets: {
    ethereum: {
      createOnLogin: 'users-without-wallets',
    },
  },
  // Default chain
  defaultChain: base,
  // Supported chains
  supportedChains: [base],
};
