import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor configuration for Loyal Spark native apps.
 * 
 * Two app variants are supported from one codebase:
 * 
 * 1. SHOPPER app (app.loyalspark.shopper)
 *    - Entry: /native/shopper
 *    - For customers: QR codes, balances, vouchers, marketplace
 * 
 * 2. BUSINESS app (app.loyalspark.business)  
 *    - Entry: /native/business
 *    - For merchants: CRM, minting, analytics, rewards
 * 
 * To switch between variants:
 *   1. Change `appId` and `appName` below
 *   2. Change the `server.url` path to match (/native/shopper or /native/business)
 *   3. Run `npx cap sync`
 * 
 * For development with hot-reload, uncomment the server.url line.
 * For production builds, comment it out so the app uses the bundled dist/.
 */

// Toggle this to build Shopper or Business variant
const APP_VARIANT: 'shopper' | 'business' = 'shopper';

const appConfigs = {
  shopper: {
    appId: 'app.loyalspark.shopper',
    appName: 'Loyal Spark',
    serverPath: '/native/shopper',
  },
  business: {
    appId: 'app.loyalspark.business',
    appName: 'Loyal Spark Business',
    serverPath: '/native/business',
  },
};

const variant = appConfigs[APP_VARIANT];

const config: CapacitorConfig = {
  appId: variant.appId,
  appName: variant.appName,
  webDir: 'dist',
  server: {
    // Uncomment for development hot-reload:
    // url: `https://9f9b9a35-7ebe-4782-9103-fd6fffe9fbe0.lovableproject.com?forceHideBadge=true`,
    // cleartext: true,
    
    // In production, the app will load from the bundled dist/ folder
    // The initial path is set via the app's router
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#000000',
      showSpinner: false,
    },
  },
  // iOS-specific settings
  ios: {
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
    scheme: 'loyalspark',
  },
  // Android-specific settings
  android: {
    backgroundColor: '#000000',
  },
};

export default config;
