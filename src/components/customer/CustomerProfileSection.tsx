import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { WalletQRCode } from '@/components/WalletQRCode';
import { ReferralCard } from '@/components/referral/ReferralCard';
import { ReferralCodeInput } from '@/components/referral/ReferralCodeInput';
import { CustomerReviewsSection } from '@/components/reviews/CustomerReviewsSection';
import { DexIntegration } from '@/components/DexIntegration';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePrivySafe } from '@/hooks/usePrivySafe';
import { getPrivyPrimaryEmail } from '@/lib/privyAuth';
import { AuthPrompt } from '@/components/AuthPrompt';
import { Mail, Phone, Wallet, Save, Copy, Check, ShieldCheck, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PrimaryWalletSelector } from '@/components/identity/PrimaryWalletSelector';
import { LinkedWalletsSummary } from '@/components/identity/LinkedWalletsSummary';
import { SecondaryWalletNotice } from '@/components/identity/SecondaryWalletNotice';

export function CustomerProfileSection() {
  const { address } = useAccount();
  const { user, session, isLoading: authLoading, signOut } = useAuth();
  const privy = usePrivySafe();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [, setLoaded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false);
  const [conflictedEmail, setConflictedEmail] = useState<string>('');

  // Email currently verified by Privy on this session (read-only source of truth)
  const privyVerifiedEmail = getPrivyPrimaryEmail(privy.user);

  useEffect(() => {
    if (!address) return;
    const load = async () => {
      const { data } = await supabase
        .from('customer_profiles')
        .select('first_name, last_name, email, phone')
        .eq('wallet_address', address.toLowerCase())
        .maybeSingle();
      if (data) {
        setFirstName(data.first_name || '');
        setLastName(data.last_name || '');
        setEmail(data.email || '');
        setPhone(data.phone || '');
      } else if (privyVerifiedEmail) {
        // Pre-fill from Privy if we have nothing stored
        setEmail(privyVerifiedEmail);
      }
      setLoaded(true);
    };
    load();
  }, [address, privyVerifiedEmail]);

  if (authLoading) return null;

  if (!address || !user || !session) {
    return (
      <div className="space-y-4">
        <AuthPrompt />
        <Alert>
          <Wallet className="h-4 w-4" />
          <AlertDescription>Please sign in to view your profile</AlertDescription>
        </Alert>
      </div>
    );
  }

  const initials = firstName && lastName
    ? `${firstName[0]}${lastName[0]}`.toUpperCase()
    : address.slice(2, 4).toUpperCase();

  const emailIsVerified =
    !!email && !!privyVerifiedEmail && email.toLowerCase() === privyVerifiedEmail.toLowerCase();

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      // Save name + phone always; email only if it's verified by Privy.
      // Unverified email entry must go through "Verify email" flow below.
      const payload: Record<string, string | null> = {
        wallet_address: address.toLowerCase(),
        first_name: firstName || null,
        last_name: lastName || null,
        phone: phone || null,
      };
      if (emailIsVerified) {
        payload.email = email;
      }

      const { error } = await supabase
        .from('customer_profiles')
        .upsert(payload, { onConflict: 'wallet_address' });
      if (error) throw error;

      // Mirror verified email to profiles row too
      if (emailIsVerified && user) {
        await supabase.from('profiles').update({ email }).eq('user_id', user.id);
      }
      toast.success('Profile saved');
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string } | null;
      const msg = err?.message ?? '';
      const isUnique = err?.code === '23505' || /duplicate key|unique/i.test(msg);
      if (isUnique && /phone/i.test(msg)) {
        toast.error('This phone is already used by another account');
      } else if (isUnique) {
        toast.error('This contact is already used by another account');
      } else {
        toast.error('Failed to save profile');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleVerifyEmail = async () => {
    if (!privy.ready) {
      toast.error('Sign-in service not ready yet');
      return;
    }
    if (!privy.authenticated) {
      toast.error('Open the sign-in window first to verify your email');
      privy.login({ loginMethods: ['email'] });
      return;
    }

    // If user already has a different verified email — block (one verified email per Privy identity)
    if (privyVerifiedEmail && email && privyVerifiedEmail.toLowerCase() !== email.toLowerCase()) {
      toast.error(
        `This account is already verified with ${privyVerifiedEmail}. Use that email or unlink it first.`
      );
      return;
    }

    try {
      // Privy opens its own modal asking for the code sent to this email.
      privy.linkEmail();
      toast.info('Check your inbox for a verification code');
    } catch (e) {
      console.error('linkEmail failed:', e);
      toast.error('Could not start email verification');
    }
  };

  // After Privy verifies the email, persist it.
  useEffect(() => {
    if (!user || !address || !privyVerifiedEmail) return;
    if (email.toLowerCase() === privyVerifiedEmail.toLowerCase()) return;

    let cancelled = false;
    (async () => {
      try {
        const { error: cpErr } = await supabase
          .from('customer_profiles')
          .upsert(
            { wallet_address: address.toLowerCase(), email: privyVerifiedEmail },
            { onConflict: 'wallet_address' }
          );

        if (cpErr) {
          const code = (cpErr as { code?: string }).code;
          const msg = cpErr.message ?? '';
          if (code === '23505' || /duplicate key|unique/i.test(msg)) {
            if (!cancelled) {
              setConflictedEmail(privyVerifiedEmail);
              setConflictDialogOpen(true);
            }
            return;
          }
          throw cpErr;
        }

        await supabase.from('profiles').update({ email: privyVerifiedEmail }).eq('user_id', user.id);

        if (!cancelled) {
          setEmail(privyVerifiedEmail);
          toast.success('Email verified and saved');
        }
      } catch (err) {
        console.error('Failed to persist verified email:', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [privyVerifiedEmail, user, address, email]);

  const handleConflictLogin = async () => {
    setConflictDialogOpen(false);
    try {
      await signOut();
    } catch (e) {
      console.error('signOut failed:', e);
    }
    // Tiny delay so Privy state settles after Supabase signOut, then re-open Privy
    setTimeout(() => {
      try {
        privy.login({ loginMethods: ['email'], prefill: { type: 'email', value: conflictedEmail } });
      } catch (e) {
        console.error('Privy login failed:', e);
        privy.login();
      }
    }, 250);
  };

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    toast.success('Address copied');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      <SecondaryWalletNotice />

      <Card className="border-2">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <Avatar className="h-14 w-14 border-2 border-primary/20">
              <AvatarFallback className="bg-primary/10 text-primary text-lg font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg">
                {firstName || lastName ? `${firstName} ${lastName}`.trim() : 'My Profile'}
              </CardTitle>
              <button
                onClick={handleCopyAddress}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors font-mono"
              >
                {address.slice(0, 6)}...{address.slice(-4)}
                {copied ? <Check className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">First Name</Label>
              <Input
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                placeholder="Jane"
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Last Name</Label>
              <Input
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                placeholder="Doe"
                className="h-9"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs flex items-center gap-1">
              <Mail className="h-3 w-3" /> Email
              {emailIsVerified && (
                <Badge variant="secondary" className="ml-2 h-4 gap-1 px-1.5 text-[10px]">
                  <ShieldCheck className="h-2.5 w-2.5" /> Verified
                </Badge>
              )}
            </Label>
            <div className="flex gap-2">
              <Input
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="jane@example.com"
                type="email"
                className="h-9"
                readOnly={emailIsVerified}
              />
              {!emailIsVerified && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleVerifyEmail}
                  className="h-9 shrink-0"
                  disabled={!email}
                >
                  Verify
                </Button>
              )}
            </div>
            {!emailIsVerified && email && (
              <p className="text-[11px] text-muted-foreground flex items-start gap-1 pt-0.5">
                <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                Click <strong>Verify</strong> to confirm this email with a code. Unverified emails
                are not saved.
              </p>
            )}
          </div>

          <div className="space-y-1">
            <Label className="text-xs flex items-center gap-1"><Phone className="h-3 w-3" /> Phone</Label>
            <Input
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+1 234 567 8900"
              className="h-9"
            />
          </div>

          <Button onClick={handleSaveProfile} disabled={saving} size="sm" className="w-full">
            <Save className="h-4 w-4 mr-1.5" />
            {saving ? 'Saving...' : 'Save Profile'}
          </Button>
        </CardContent>
      </Card>

      <PrimaryWalletSelector />
      <LinkedWalletsSummary />

      <WalletQRCode />
      <ReferralCodeInput />
      <ReferralCard />
      <CustomerReviewsSection />
      <DexIntegration />

      <AlertDialog open={conflictDialogOpen} onOpenChange={setConflictDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>This email is already linked to another account</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-mono">{conflictedEmail}</span> is already verified on a
              different Loyal Spark account. To keep all your data in one place, sign in with that
              email — your current wallet can then be added as a secondary wallet.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConflictLogin}>
              Sign in with this email
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
