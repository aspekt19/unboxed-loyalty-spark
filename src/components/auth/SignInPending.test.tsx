import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SignInDialog } from './SignInDialog';
import { WalletConnectButton } from '../WalletConnectButton';

const mocks = vi.hoisted(() => ({
  pending: false,
  login: vi.fn(),
  verify: vi.fn(),
  oauth: vi.fn(),
  send: vi.fn(),
}));

vi.mock('wagmi', () => ({
  useConnect: () => ({ connectors: [], connect: vi.fn(), connectAsync: vi.fn() }),
  useAccount: () => ({ isConnected: false }),
  useDisconnect: () => ({ disconnectAsync: vi.fn() }),
}));
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: null, isLoading: false, signOut: vi.fn(), resetManualSignOut: vi.fn() }),
  clearManualSignOut: vi.fn(),
}));
vi.mock('@/hooks/useIdentity', () => ({
  useIdentity: () => ({ user: null, ready: true, authenticated: false, signInPending: mocks.pending, login: mocks.login }),
}));
vi.mock('@/config/wagmi', () => ({ isFarcasterContext: () => false, CDP_CONNECTOR_ID: 'cdp' }));
vi.mock('@/config/cdp', () => ({ isCdpEnabled: true }));
vi.mock('@farcaster/miniapp-sdk', () => ({ sdk: { context: Promise.resolve({}) } }));
vi.mock('@coinbase/cdp-core', () => ({
  signInWithEmail: mocks.send, verifyEmailOTP: mocks.verify, signInWithOAuth: mocks.oauth,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.pending = false;
  mocks.send.mockResolvedValue({ flowId: 'test-flow' });
});
afterEach(cleanup);

describe('pre-session sign-in feedback', () => {
  it('blocks another header login immediately, before any identity user or app loading state exists', async () => {
    mocks.pending = true;
    render(<WalletConnectButton />);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(mocks.login).not.toHaveBeenCalled();
    await act(async () => {});
  });

  it('marks Google pending before starting the redirect and clears it on failure', async () => {
    const pending = vi.fn();
    mocks.oauth.mockImplementation(async () => {
      expect(pending).toHaveBeenLastCalledWith(true);
      throw new Error('Cancelled');
    });
    render(<SignInDialog open mode="all" onOpenChange={vi.fn()} onSignInPendingChange={pending} />);
    fireEvent.click(screen.getByRole('button', { name: /Continue with Google/ }));
    await waitFor(() => expect(pending).toHaveBeenLastCalledWith(false));
    expect(mocks.oauth).toHaveBeenCalledTimes(1);
  });

  it.each([true, false])('keeps OTP feedback pending until verification settles (success: %s)', async (success) => {
    const pending = vi.fn();
    const close = vi.fn();
    let finish: (() => void) | undefined;
    mocks.verify.mockImplementation(() => new Promise<void>((resolve, reject) => {
      finish = () => success ? resolve() : reject(new Error('Invalid code'));
    }));
    render(<SignInDialog open mode="all" onOpenChange={close} onSignInPendingChange={pending} />);
    fireEvent.click(screen.getByRole('button', { name: /Continue with email/ }));
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: 'test@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send code' }));
    await screen.findByPlaceholderText('123456');
    expect(pending).not.toHaveBeenCalled();
    fireEvent.change(screen.getByPlaceholderText('123456'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));
    expect(pending).toHaveBeenLastCalledWith(true);
    expect(screen.getByRole('button', { name: 'Verify' })).toBeDisabled();
    expect(close).not.toHaveBeenCalled();
    await act(async () => { finish?.(); });
    if (success) {
      expect(close).toHaveBeenCalledWith(false);
      expect(pending).toHaveBeenCalledTimes(1);
    } else {
      expect(pending).toHaveBeenLastCalledWith(false);
      expect(close).not.toHaveBeenCalled();
    }
    expect(mocks.verify).toHaveBeenCalledTimes(1);
  });
});