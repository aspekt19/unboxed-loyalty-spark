import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { WalletQRCode } from '@/components/WalletQRCode';
import { ReferralCard } from '@/components/referral/ReferralCard';
import { ReferralCodeInput } from '@/components/referral/ReferralCodeInput';
import { CustomerReviewsSection } from '@/components/reviews/CustomerReviewsSection';
import { DexIntegration } from '@/components/DexIntegration';
import { LinkedAccounts } from '@/components/identity/LinkedAccounts';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AuthPrompt } from '@/components/AuthPrompt';
import { Mail, Phone, Wallet, Save, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function CustomerProfileSection() {
  const { address } = useAccount();
  const { user, session, isLoading: authLoading } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [, setLoaded] = useState(false);
  const [copied, setCopied] = useState(false);

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
      }
      setLoaded(true);
    };
    load();
  }, [address]);

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

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('customer_profiles')
        .upsert({
          wallet_address: address.toLowerCase(),
          first_name: firstName || null,
          last_name: lastName || null,
          email: email || null,
          phone: phone || null,
        }, { onConflict: 'wallet_address' });
      if (error) throw error;
      toast.success('Profile saved');
    } catch {
      toast.error('Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    toast.success('Address copied');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
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
            <Label className="text-xs flex items-center gap-1"><Mail className="h-3 w-3" /> Email</Label>
            <Input
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="jane@example.com"
              type="email"
              className="h-9"
            />
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
          <Button onClick={handleSave} disabled={saving} size="sm" className="w-full">
            <Save className="h-4 w-4 mr-1.5" />
            {saving ? 'Saving...' : 'Save Profile'}
          </Button>
        </CardContent>
      </Card>

      <WalletQRCode />
      <LinkedAccounts />
      <ReferralCodeInput />
      <ReferralCard />
      <CustomerReviewsSection />
      <DexIntegration />
    </div>
  );
}
