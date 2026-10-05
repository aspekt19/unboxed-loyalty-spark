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

  // Mobile browsers (Safari/Chrome) have no injected wallet: hide that option and
  // offer deep links into popular wallet apps instead of failing with "Provider not found".
  const hasInjected = typeof window !== 'undefined' && !!(window as unknown as { ethereum?: unknown }).ethereum;
  const walletConnectors = connectors.filter((c) => c.id !== CDP_CONNECTOR_ID && (c.id !== 'injected' || hasInjected));
  const dappUrl =
    typeof window !== 'undefined'
      ? `${window.location.host}${window.location.pathname}${window.location.search}`
      : '';
  const walletAppLinks: { name: string; href: string }[] = dappUrl
    ? [
        { name: 'MetaMask', href: `https://metamask.app.link/dapp/${dappUrl}` },
        { name: 'Trust Wallet', href: `https://link.trustwallet.com/open_url?url=https://${dappUrl}` },
        { name: 'Rainbow', href: `https://rainbow.me/dapp?url=https://${dappUrl}` },
      ]
    : [];

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

  const connectWallet = async (id: string) => {
    const connector = connectors.find((c) => c.id === id);
    if (!connector) return;
    setBusy(id);
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

  const walletLabel = (name: string, id: string) => {
    if (id === 'injected') return 'Browser wallet (MetaMask, Rabby…)';
    if (/coinbase/i.test(name) || /coinbase/i.test(id)) return 'Coinbase Wallet / Base App';
    return name;
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
          <div className="flex flex-col gap-2">
            <Button variant="outline" className="h-11 justify-start gap-3" onClick={() => void google()} disabled={!!busy}>
              {busy === 'google' ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon />}
              Continue with Google
            </Button>
            <Button variant="outline" className="h-11 justify-start gap-3" onClick={() => setStep('email')} disabled={!!busy}>
              <Mail className="h-4 w-4" />
              Continue with email
            </Button>
            <Button variant="ghost" className="h-11 justify-start gap-3" onClick={() => setStep('wallet')} disabled={!!busy}>
              <Wallet className="h-4 w-4" />
              I have a wallet
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
          <div className="flex flex-col gap-2">
            {walletConnectors.map((c) => (
              <Button key={c.uid} variant="outline" className="h-11 justify-start gap-3" onClick={() => void connectWallet(c.id)} disabled={!!busy}>
                {busy === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
                <span className="truncate">{walletLabel(c.name, c.id)}</span>
              </Button>
            ))}
            {!hasInjected && (
              <Button asChild variant="outline" className="h-11 justify-start gap-3">
                <a href={metamaskDeepLink} onClick={() => { clearManualSignOut(); rememberPostLoginPath(); }}>
                  <Wallet className="h-4 w-4" />
                  <span className="truncate">Open in MetaMask app</span>
                </a>
              </Button>
            )}
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
