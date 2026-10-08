import { useEffect, useState } from 'react';
import { useConnect } from 'wagmi';
import { signInWithEmail, signInWithOAuth, verifyEmailOTP } from '@coinbase/cdp-core';
import { ArrowLeft, Loader2, Mail, MonitorSmartphone, QrCode, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { isCdpEnabled } from '@/config/cdp';
import { CDP_CONNECTOR_ID } from '@/config/wagmi';
import { rememberPostLoginPath } from '@/lib/postLoginRedirect';
import { clearManualSignOut } from '@/contexts/AuthContext';
import { GoogleIcon, MethodRow } from '@/components/auth/SignInMethodRow';

export type SignInDialogMode = 'all' | 'wallet';

type Step = 'choose' | 'email' | 'otp' | 'wallet';

export function SignInDialog({ open, mode, onOpenChange, onSignInPendingChange }: { open: boolean; mode: SignInDialogMode; onOpenChange: (open: boolean) => void; onSignInPendingChange: (pending: boolean) => void }) {
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

  const hasInjected = typeof window !== 'undefined' && Boolean((window as unknown as { ethereum?: unknown }).ethereum);
  const walletConnectors = connectors.filter((connector) => {
    if (connector.id === CDP_CONNECTOR_ID) return false;
    if (connector.id === 'injected') return hasInjected;
    if (connector.id === 'walletConnect') return true;
    return /coinbase/i.test(connector.id);
  });

  const google = async () => {
    setBusy('google');
    onSignInPendingChange(true);
    try {
      clearManualSignOut();
      rememberPostLoginPath();
      await signInWithOAuth('google');
    } catch (e) {
      onSignInPendingChange(false);
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
    onSignInPendingChange(true);
    try {
      clearManualSignOut();
      await verifyEmailOTP({ flowId, otp: otp.trim() });
      onOpenChange(false);
    } catch (e) {
      onSignInPendingChange(false);
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
      return { label: 'Browser wallet', detail: 'MetaMask or Rabby, already in this browser', icon: <MonitorSmartphone className="h-4 w-4" /> };
    }
    if (/coinbase/i.test(name) || /coinbase/i.test(id)) {
      return { label: 'Coinbase Wallet / Base App', detail: 'Opens the app you already use', icon: <Wallet className="h-4 w-4" /> };
    }
    if (id === 'walletConnect') {
      return { label: 'Other wallets', detail: 'Scan a code. Trust, Rainbow, and more', icon: <QrCode className="h-4 w-4" /> };
    }
    return { label: name, detail: 'You pay the network fee', icon: <Wallet className="h-4 w-4" /> };
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-[22rem] gap-5 rounded-3xl p-5 sm:rounded-3xl">
        <DialogHeader className="space-y-2 pr-6 text-left">
          <DialogTitle className="text-xl">Sign in to Loyal Spark</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            {step === 'otp'
              ? `We sent a 6-digit code to ${email.trim()}.`
              : step === 'email'
                ? 'We email you a code. There is no password.'
                : step === 'wallet'
                  ? 'You pay the network fee with these wallets.'
                  : 'Google and email include a wallet. We cover the network fee.'}
          </DialogDescription>
        </DialogHeader>

        {step === 'choose' && (
          <div className="flex flex-col gap-2.5">
            <MethodRow
              icon={busy === 'google' ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon />}
              title="Continue with Google"
              detail="Fastest. A wallet is created for you."
              onClick={() => void google()}
              disabled={!!busy}
            />
            <MethodRow
              icon={<Mail className="h-4 w-4" />}
              title="Continue with email"
              detail="We send a 6-digit code."
              onClick={() => setStep('email')}
              disabled={!!busy}
            />
            <div className="flex items-center gap-3 py-1" aria-hidden="true">
              <div className="h-px flex-1 bg-border" />
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">or</span>
              <div className="h-px flex-1 bg-border" />
            </div>
            <MethodRow
              tone="quiet"
              icon={<Wallet className="h-4 w-4" />}
              title="I already have a wallet"
              detail="Coinbase, a browser wallet, or a QR code. You pay the fee."
              onClick={() => setStep('wallet')}
              disabled={!!busy}
            />
          </div>
        )}

        {step === 'email' && (
          <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); void sendCode(); }}>
            <Input type="email" autoComplete="email" inputMode="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus className="h-11 rounded-xl" />
            <Button type="submit" className="h-11 rounded-xl" disabled={!!busy}>
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
            <Input inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="123456" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} autoFocus className="h-12 rounded-xl text-center text-lg tracking-[0.4em]" />
            <Button type="submit" className="h-11 rounded-xl" disabled={!!busy || otp.length < 6}>
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
            {walletConnectors.length === 0 && (
              <p className="rounded-2xl bg-muted px-3.5 py-3 text-sm text-muted-foreground">
                No wallet connector is available in this browser.
              </p>
            )}
            {walletConnectors.map((c) => {
              const meta = walletMeta(c.name, c.id);
              return (
                <MethodRow
                  key={c.uid}
                  icon={busy === c.uid ? <Loader2 className="h-4 w-4 animate-spin" /> : meta.icon}
                  title={meta.label}
                  detail={meta.detail}
                  onClick={() => void connectWallet(c.uid)}
                  disabled={!!busy}
                />
              );
            })}
            {isCdpEnabled && mode !== 'wallet' && (
              <Button type="button" variant="ghost" className="gap-2" onClick={() => setStep('choose')}>
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
