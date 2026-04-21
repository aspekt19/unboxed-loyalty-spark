import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Wallet, DollarSign, Bot } from 'lucide-react';
import { toast } from 'sonner';

export const PaymentSettingsManagement = () => {
  const queryClient = useQueryClient();
  const [walletAddress, setWalletAddress] = useState('');
  const [subscriptionWallet, setSubscriptionWallet] = useState('');
  const [usdcPrice, setUsdcPrice] = useState('');

  const { data: settings, isLoading } = useQuery({
    queryKey: ['payment-settings-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_settings')
        .select('*')
        .single();

      if (error) throw error;
      
      setWalletAddress(data.admin_wallet_address);
      setSubscriptionWallet((data as any).subscription_wallet_address || '');
      setUsdcPrice(data.usdc_price.toString());
      
      return data;
    },
  });

  const updateSettings = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('payment_settings')
        .update({
          admin_wallet_address: walletAddress,
          subscription_wallet_address: subscriptionWallet,
          usdc_price: parseFloat(usdcPrice),
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', settings?.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Payment settings updated successfully!');
      queryClient.invalidateQueries({ queryKey: ['payment-settings-admin'] });
      queryClient.invalidateQueries({ queryKey: ['payment-settings'] });
      queryClient.invalidateQueries({ queryKey: ['agent-payment-info'] });
    },
    onError: (error) => {
      console.error('Update error:', error);
      toast.error('Failed to update settings');
    },
  });

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment Settings</CardTitle>
        <CardDescription>
          Configure wallet addresses and pricing for premium and agent subscriptions
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="wallet" className="flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            Admin Wallet (fee collection)
          </Label>
          <Input
            id="wallet"
            placeholder="0x..."
            value={walletAddress}
            onChange={(e) => setWalletAddress(e.target.value)}
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Receives onchain transaction fees from agent mints
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="sub-wallet" className="flex items-center gap-2">
            <Bot className="h-4 w-4" />
            Subscription Wallet (plan payments)
          </Label>
          <Input
            id="sub-wallet"
            placeholder="0x..."
            value={subscriptionWallet}
            onChange={(e) => setSubscriptionWallet(e.target.value)}
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Receives USDC payments for agent Pro/Enterprise plans
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="price" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Premium Price (USDC)
          </Label>
          <Input
            id="price"
            type="number"
            step="0.01"
            min="0"
            placeholder="10.00"
            value={usdcPrice}
            onChange={(e) => setUsdcPrice(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Monthly subscription price in USDC for premium access
          </p>
        </div>

        <Button
          onClick={() => updateSettings.mutate()}
          disabled={updateSettings.isPending || !walletAddress || !usdcPrice}
          className="w-full"
        >
          {updateSettings.isPending ? 'Saving...' : 'Save Settings'}
        </Button>
      </CardContent>
    </Card>
  );
};
