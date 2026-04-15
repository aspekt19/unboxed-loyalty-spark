import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAccount } from 'wagmi';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { KeyRound, Loader2 } from 'lucide-react';

const ERROR_MESSAGES: Record<string, string> = {
  invalid_code: 'Enter the invite code from your employer.',
  no_profile: 'Sign in first and make sure your profile has a wallet address.',
  invite_not_found: 'Invalid or expired code, or it was already used.',
  already_member: 'You are already on this team.',
};

export function AcceptMerchantInviteCard() {
  const { address } = useAccount();
  const { user, session } = useAuth();
  const queryClient = useQueryClient();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  if (!address || !user || !session) return null;

  const handleSubmit = async () => {
    const trimmed = code.trim();
    if (!trimmed) {
      toast.error('Paste the invite code');
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc('accept_merchant_invite' as any, {
        p_invite_code: trimmed,
      });
      if (error) {
        toast.error(error.message || 'Could not join team');
        return;
      }
      const row = data as { ok?: boolean; error?: string; merchant_address?: string } | null;
      if (!row?.ok) {
        const key = row?.error ?? 'invite_not_found';
        toast.error(ERROR_MESSAGES[key] ?? 'Could not join team');
        return;
      }
      toast.success('You joined the merchant team.');
      setCode('');
      await queryClient.invalidateQueries({ queryKey: ['merchant-employees'] });
      await queryClient.invalidateQueries({ queryKey: ['merchant-invites'] });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="border border-dashed border-primary/40 bg-muted/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-primary" />
          Team invite code
        </CardTitle>
        <CardDescription className="text-xs">
          If the business owner sent you a code (cashier / manager), paste it here while signed in with the
          same wallet you will use at work.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1 space-y-1">
            <Label htmlFor="merchant-invite-code" className="text-xs">
              Invite code
            </Label>
            <Input
              id="merchant-invite-code"
              placeholder="e.g. A1B2C3D4"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="font-mono text-sm h-9"
              autoCapitalize="characters"
            />
          </div>
          <div className="flex items-end">
            <Button type="button" size="sm" className="w-full sm:w-auto" disabled={busy} onClick={() => void handleSubmit()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Join team'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
