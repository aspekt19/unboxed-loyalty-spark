import { useEffect, useState } from 'react';
import { useConnect } from 'wagmi';
import { signInWithEmail, signInWithOAuth, verifyEmailOTP } from '@coinbase/cdp-core';
import { ArrowLeft, Loader2, Mail, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { isCdpEnabled } from '@/config/cdp';
import { CDP_CONNECTOR_ID } from '@/config/wagmi';
import { rememberPostLoginPath } from '@/lib/postLoginRedirect';
import { clearManualSignOut } from '@/contexts/AuthContext';

export type SignInDialogMode = 'all' | 'wallet';

type Step = 'choose' | 'email' | 'otp' | 'wallet';

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path fill="currentColor" d="M21.35 11.1H12v2.98h5.35c-.23 1.4-1.66 4.1-5.35 4.1a6.18 6.18 0 0 1 0-12.36c1.9 0 3.17.8 3.9 1.5l2.66-2.56C16.85 3.2 14.65 2.2 12 2.2a9.8 9.8 0 1 0 0 19.6c5.66 0 9.4-3.97 9.4-9.57 0-.64-.07-1.13-.15-1.6z" />
    </svg>
  );
}

export function SignInDialog({ open, mode, onOpenChange }: { open: boolean; mode: SignInDialogMode; onOpenChange: (open: boolean) => void }) {
  const { connectors, connectAsync } = useConnect();
  const [step, setStep] = useState<Step>('choose');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [flowId, setFlowId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep(mode === 'wallet' || !isCdpEnabled ? 'wallet' : 'choose');
    setOtp('');
    setBusy(null);
  }, [open, mode]);

  // Three options only, so nothing overflows the dialog: a wallet already installed
  // in this browser (hidden when there is none, e.g. mobile Chrome), Coinbase Wallet /
  // Base App, and "Other wallets" via WalletConnect. Anything else the page discovers
  // is dropped — the injected connector already represents those browser wallets.
  const hasInjected = typeof window !== 'undefined' && Boolean((window as unknown as { ethereum?: unknown }).ethereum);
  const walletConnectors = connectors.filter((connector) => {
    if (connector.id === CDP_CONNECTOR_ID) return false;
    if (connector.id === 'injected') return hasInjected;
    if (connector.id === 'walletConnect') return true;
    return /coinbase/i.test(connector.id);
  });

  const google = async () => {
    setBusy('google');
    try {
      clearManualSignOut();
      rememberPostLoginPath();
      await signInWithOAuth('google');
    } catch (e) {
      toast.error((e as Error)?.message || 'Google sign-in failed');
      setBusy(null);
    }
  };

  const sendCode = async () => {
    const value = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(value)) {
      toast.error('Enter a valid email address');
      return;
    }
    setBusy('email');
    try {
      const res = await signInWithEmail({ email: value });
      setFlowId(res.flowId);
      setStep('otp');
    } catch (e) {
      toast.error((e as Error)?.message || 'Could not send the code');
    } finally {
      setBusy(null);
    }
  };

  const verify = async () => {
    if (!flowId || otp.trim().length < 6) return;
    setBusy('otp');
    try {
      clearManualSignOut();
      await verifyEmailOTP({ flowId, otp: otp.trim() });
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error)?.message || 'Invalid code');
    } finally {
      setBusy(null);
    }
  };

  const connectWallet = async (uid: string) => {
    const connector = connectors.find((candidate) => candidate.uid === uid);
    if (!connector) return;
    setBusy(uid);
    try {
      clearManualSignOut();
      await connectAsync({ connector });
      onOpenChange(false);
    } catch (e) {
      const msg = (e as Error)?.message || '';
      if (!/reject|denied|cancel/i.test(msg)) toast.error(msg || 'Could not connect wallet');
    } finally {
      setBusy(null);
    }
  };

  const walletMeta = (name: string, id: string) => {
    if (id === 'injected') {
      return { label: 'Browser wallet', sub: 'MetaMask or Rabby in this browser' };
    }
    if (/coinbase/i.test(name) || /coinbase/i.test(id)) {
      return { label: 'Coinbase Wallet / Base App', sub: 'Connects in one tap' };
    }
    if (id === 'walletConnect') {
      return { label: 'Other wallets', sub: 'MetaMask, Trust, Rainbow and 400+ more' };
    }
    return { label: name, sub: undefined as string | undefined };
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-sm rounded-2xl">
        <DialogHeader className="text-left">
          <DialogTitle>Sign in to Loyal Spark</DialogTitle>
          <DialogDescription>
            {step === 'otp'
              ? `We sent a 6-digit code to ${email.trim()}.`
              : step === 'wallet'
                ? 'Connect a wallet you already use. You pay network fees yourself.'
                : 'Google and email sign-in create a free wallet with no network fees.'}
          </DialogDescription>
        </DialogHeader>

        {step === 'choose' && (
          <div className="flex flex-col gap-2.5">
            <Button variant="outline" className="h-auto min-h-[3.5rem] justify-start gap-3 rounded-xl px-3.5 py-2.5 text-left" onClick={() => void google()} disabled={!!busy}>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                {busy === 'google' ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">Continue with Google</span>
                <span className="block truncate text-xs text-muted-foreground">Free wallet, no network fees</span>
              </span>
            </Button>
            <Button variant="outline" className="h-auto min-h-[3.5rem] justify-start gap-3 rounded-xl px-3.5 py-2.5 text-left" onClick={() => setStep('email')} disabled={!!busy}>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <Mail className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">Continue with email</span>
                <span className="block truncate text-xs text-muted-foreground">We send you a 6-digit code</span>
              </span>
            </Button>
            <Button variant="ghost" className="h-auto min-h-[3.5rem] justify-start gap-3 rounded-xl px-3.5 py-2.5 text-left" onClick={() => setStep('wallet')} disabled={!!busy}>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
                <Wallet className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">I have a wallet</span>
                <span className="block truncate text-xs text-muted-foreground">Coinbase Wallet, browser wallet and more</span>
              </span>
            </Button>
          </div>
        )}

        {step === 'email' && (
          <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); void sendCode(); }}>
            <Input type="email" autoComplete="email" inputMode="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
            <Button type="submit" className="h-11" disabled={!!busy}>
              {busy === 'email' && <Loader2 className="h-4 w-4 animate-spin" />}
              Send code
            </Button>
            <Button type="button" variant="ghost" className="gap-2" onClick={() => setStep('choose')}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
          </form>
        )}

        {step === 'otp' && (
          <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); void verify(); }}>
            <Input inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="123456" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} autoFocus className="text-center tracking-[0.4em] text-lg" />
            <Button type="submit" className="h-11" disabled={!!busy || otp.length < 6}>
              {busy === 'otp' && <Loader2 className="h-4 w-4 animate-spin" />}
              Verify
            </Button>
            <Button type="button" variant="ghost" className="gap-2" onClick={() => setStep('email')}>
              <ArrowLeft className="h-4 w-4" /> Use another email
            </Button>
          </form>
        )}

        {step === 'wallet' && (
          <div className="flex flex-col gap-2.5">
            {walletConnectors.map((c) => {
              const meta = walletMeta(c.name, c.id);
              return (
                <Button
                  key={c.uid}
                  variant="outline"
                  className="h-auto min-h-[3.5rem] justify-start gap-3 rounded-xl px-3.5 py-2.5 text-left"
                  onClick={() => void connectWallet(c.uid)}
                  disabled={!!busy}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    {busy === c.uid ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{meta.label}</span>
                    {meta.sub && <span className="block truncate text-xs text-muted-foreground">{meta.sub}</span>}
                  </span>
                </Button>
              );
            })}
            {isCdpEnabled && mode !== 'wallet' && (
              <Button variant="ghost" className="gap-2" onClick={() => setStep('choose')}>
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
