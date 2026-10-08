import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAccount, useDisconnect } from 'wagmi';
import { getAddress } from 'viem';
import {
  CDPHooksProvider,
  useCurrentUser,
  useGetAccessToken,
  useIsInitialized,
  useIsSignedIn,
  useSignOut,
} from '@coinbase/cdp-hooks';
import { cdpConfig, isCdpEnabled } from '@/config/cdp';
import { CDP_CONNECTOR_ID } from '@/config/wagmi';
import type { IdentityUser } from '@/lib/socialAuth';
import { SignInDialog, type SignInDialogMode } from '@/components/auth/SignInDialog';

export interface IdentityValue {
  /** Opens the sign-in dialog (Google, email, or external wallet). */
  login: () => void;
  logout: () => Promise<void>;
  authenticated: boolean;
  user: IdentityUser | null;
  ready: boolean;
  /** Google/OTP confirmation is underway, even before the SDK exposes a user. */
  signInPending: boolean;
  getAccessToken: () => Promise<string | null>;
  /** Opens the sign-in dialog on the wallet list. */
  connectWallet: () => void;
  /** Coinbase smart account of a Google/email user (gas-sponsored). */
  smartAccount: `0x${string}` | null;
}

const noop: IdentityValue = {
  login: () => {},
  logout: async () => {},
  authenticated: false,
  user: null,
  ready: false,
  signInPending: false,
  getAccessToken: async () => null,
  connectWallet: () => {},
  smartAccount: null,
};

const IdentityContext = createContext<IdentityValue>(noop);

/** Identity of the current human user; noop outside the browser provider tree (Farcaster). */
export function useIdentity(): IdentityValue {
  return useContext(IdentityContext);
}

type CdpState = {
  ready: boolean;
  signedIn: boolean;
  user: IdentityUser | null;
  smartAccount: `0x${string}` | null;
  getAccessToken: () => Promise<string | null>;
  signOut: () => Promise<void>;
};

const emptyCdp: CdpState = {
  ready: true,
  signedIn: false,
  user: null,
  smartAccount: null,
  getAccessToken: async () => null,
  signOut: async () => {},
};

function Core({ cdp, children }: { cdp: CdpState; children: ReactNode }) {
  const { address, isConnected, connector } = useAccount();
  const { disconnectAsync } = useDisconnect();
  const [dialog, setDialog] = useState<{ open: boolean; mode: SignInDialogMode }>({ open: false, mode: 'all' });
  const [signInPending, setSignInPending] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.has('flow_id') && params.has('provider_type') && params.has('code') && !params.has('error');
  });

  useEffect(() => {
    if (cdp.signedIn) setSignInPending(false);
  }, [cdp.signedIn]);

  // Observe callback completion only; the existing OAuth handler owns SDK verification and URL cleanup.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!signInPending || !params.has('flow_id') || !params.has('provider_type')) return;
    const timer = window.setInterval(() => {
      const current = new URLSearchParams(window.location.search);
      if (!current.has('flow_id') || !current.has('provider_type')) setSignInPending(false);
    }, 250);
    return () => window.clearInterval(timer);
  }, [signInPending]);

  // The Coinbase connector can report the inner signer address if it connected before the
  // smart account loaded. The app identity (profile, programs, sponsored gas) is the smart
  // account, so re-sync wagmi to it whenever they differ.
  const smartForSync = cdp.signedIn ? cdp.smartAccount : null;
  useEffect(() => {
    if (!smartForSync || !address || connector?.id !== CDP_CONNECTOR_ID) return;
    if (address.toLowerCase() === smartForSync.toLowerCase()) return;
    connector.emitter.emit('change', { accounts: [getAddress(smartForSync)] });
  }, [smartForSync, address, connector]);

  const externalWallet = isConnected && address && connector?.id !== CDP_CONNECTOR_ID ? address.toLowerCase() : null;

  const user = useMemo<IdentityUser | null>(() => {
    if (cdp.signedIn && cdp.user) return cdp.user;
    if (externalWallet) return { id: `wallet:${externalWallet}`, linkedAccounts: [{ type: 'wallet', address: externalWallet }] };
    return null;
  }, [cdp.signedIn, cdp.user, externalWallet]);

  const logout = useCallback(async () => {
    setSignInPending(false);
    try { await cdp.signOut(); } catch { /* not signed in */ }
    try { await disconnectAsync(); } catch { /* no connector */ }
  }, [cdp, disconnectAsync]);

  const value = useMemo<IdentityValue>(() => ({
    login: () => { setSignInPending(false); setDialog({ open: true, mode: 'all' }); },
    connectWallet: () => setDialog({ open: true, mode: 'wallet' }),
    logout,
    authenticated: Boolean(user),
    user,
    ready: cdp.ready,
    signInPending: signInPending || (cdp.signedIn && !cdp.user),
    getAccessToken: cdp.getAccessToken,
    smartAccount: cdp.signedIn ? cdp.smartAccount : null,
  }), [logout, user, cdp.ready, cdp.getAccessToken, cdp.signedIn, cdp.smartAccount, signInPending]);

  return (
    <IdentityContext.Provider value={value}>
      {children}
      <SignInDialog
        open={dialog.open}
        mode={dialog.mode}
        onSignInPendingChange={setSignInPending}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
      />
    </IdentityContext.Provider>
  );
}

function CdpBridge({ children }: { children: ReactNode }) {
  const { isInitialized } = useIsInitialized();
  const { isSignedIn } = useIsSignedIn();
  const { currentUser } = useCurrentUser();
  const { getAccessToken } = useGetAccessToken();
  const { signOut } = useSignOut();

  const cdp = useMemo<CdpState>(() => {
    const smart = (currentUser?.evmSmartAccountObjects?.[0]?.address ?? currentUser?.evmSmartAccounts?.[0] ?? null) as `0x${string}` | null;
    let user: IdentityUser | null = null;
    if (currentUser) {
      const accounts: IdentityUser['linkedAccounts'] = [];
      let email: string | undefined;
      for (const [type, m] of Object.entries(currentUser.authenticationMethods ?? {})) {
        if (!m) continue;
        const methodEmail = (m as { email?: string }).email;
        if (methodEmail && !email) email = methodEmail;
        accounts.push({ type, email: methodEmail, address: methodEmail });
      }
      if (smart) accounts.push({ type: 'smart_wallet', address: smart.toLowerCase() });
      user = { id: currentUser.userId, linkedAccounts: accounts, email: email ? { address: email } : undefined };
    }
    return { ready: isInitialized, signedIn: isSignedIn, user, smartAccount: smart, getAccessToken, signOut };
  }, [isInitialized, isSignedIn, currentUser, getAccessToken, signOut]);

  return <Core cdp={cdp}>{children}</Core>;
}

/** Mount inside WagmiProvider in the regular browser tree. */
export function IdentityProvider({ children }: { children: ReactNode }) {
  if (!isCdpEnabled) return <Core cdp={emptyCdp}>{children}</Core>;
  return (
    <CDPHooksProvider config={cdpConfig}>
      <CdpBridge>{children}</CdpBridge>
    </CDPHooksProvider>
  );
}
