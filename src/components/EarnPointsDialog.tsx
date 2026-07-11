import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { QrReader } from '@blackbox-vision/react-qr-reader';
import { QrCode, X, Calculator, Coins, Mail, Phone, Wallet, Loader2, Shield, Star } from 'lucide-react';
import { useResolveRecipient } from '@/hooks/useResolveRecipient';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';

interface EarnPointsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (recipientAddress: string, tokensToMint: string) => void;
  isPending: boolean;
  cashbackRate: number;
  pointsPerDollar: number;
  programSymbol: string;
  tokenAddress?: string;
}

interface CustomerTierInfo {
  tierName: string;
  tierLevel: number;
  badgeColor: string;
  cashbackMultiplier: number;
}

export function EarnPointsDialog({
  isOpen,
  onClose,
  onSubmit,
  isPending,
  cashbackRate,
  pointsPerDollar,
  programSymbol,
  tokenAddress,
}: EarnPointsDialogProps) {
  const [recipientInput, setRecipientInput] = useState('');
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);
  const [purchaseAmount, setPurchaseAmount] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [inputType, setInputType] = useState<'wallet' | 'email' | 'phone'>('wallet');
  const { resolveRecipient, isResolving } = useResolveRecipient();
  const [tierInfo, setTierInfo] = useState<CustomerTierInfo | null>(null);
  const [isFetchingTier, setIsFetchingTier] = useState(false);

  // Effective cashback rate = base rate × tier multiplier
  const effectiveCashbackRate = tierInfo
    ? cashbackRate * tierInfo.cashbackMultiplier
    : cashbackRate;

  const cashbackDollars = purchaseAmount
    ? (parseFloat(purchaseAmount) * (effectiveCashbackRate / 100))
    : 0;
  const tokensToEarn = purchaseAmount
    ? (cashbackDollars * pointsPerDollar).toFixed(2)
    : '0';

  // Fetch customer tier when address is resolved
  useEffect(() => {
    if (!resolvedAddress || !tokenAddress) {
      setTierInfo(null);
      return;
    }

    let cancelled = false;
    setIsFetchingTier(true);

    (async () => {
      try {
        // Get customer tier status
        const { data: tierStatus } = await supabase
          .from('customer_tier_status')
          .select('current_tier_id, current_balance')
          .eq('customer_address', resolvedAddress.toLowerCase())
          .eq('token_address', tokenAddress.toLowerCase())
          .maybeSingle();

        if (cancelled) return;

        if (tierStatus?.current_tier_id) {
          const { data: tier } = await supabase
            .from('customer_tiers')
            .select('tier_name, tier_level, badge_color, cashback_multiplier')
            .eq('id', tierStatus.current_tier_id)
            .single();

          if (!cancelled && tier) {
            setTierInfo({
              tierName: tier.tier_name,
              tierLevel: tier.tier_level,
              badgeColor: tier.badge_color || '#CD7F32',
              cashbackMultiplier: tier.cashback_multiplier || 1,
            });
            return;
          }
        }

        // No tier found — default Bronze (1x)
        if (!cancelled) {
          setTierInfo({
            tierName: 'Bronze',
            tierLevel: 1,
            badgeColor: '#CD7F32',
            cashbackMultiplier: 1,
          });
        }
      } catch {
        if (!cancelled) setTierInfo(null);
      } finally {
        if (!cancelled) setIsFetchingTier(false);
      }
    })();

    return () => { cancelled = true; };
  }, [resolvedAddress, tokenAddress]);

  // Resolve address when input looks complete
  const handleLookupCustomer = useCallback(async () => {
    if (!recipientInput) return;
    const wallet = await resolveRecipient(recipientInput);
    if (wallet) setResolvedAddress(wallet);
  }, [recipientInput, resolveRecipient]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!recipientInput || !purchaseAmount || parseFloat(tokensToEarn) <= 0) return;

      let wallet = resolvedAddress;
      if (!wallet) {
        wallet = await resolveRecipient(recipientInput);
        if (!wallet) return;
      }

      onSubmit(wallet, tokensToEarn);
      setRecipientInput('');
      setPurchaseAmount('');
      setResolvedAddress(null);
      setTierInfo(null);
      setShowScanner(false);
    },
    [recipientInput, purchaseAmount, tokensToEarn, onSubmit, resolveRecipient, resolvedAddress],
  );

  const handleScan = useCallback((result: unknown) => {
    const text =
      (result as { text?: string } | null | undefined)?.text ??
      (result as { getText?: () => string } | null | undefined)?.getText?.();
    if (text) {
      setRecipientInput(text);
      setInputType('wallet');
      setShowScanner(false);
      // Auto-resolve scanned address
      (async () => {
        const wallet = await resolveRecipient(text);
        if (wallet) setResolvedAddress(wallet);
      })();
    }
  }, [resolveRecipient]);

  // Reset state on close
  useEffect(() => {
    if (!isOpen) {
      setRecipientInput('');
      setPurchaseAmount('');
      setResolvedAddress(null);
      setTierInfo(null);
      setShowScanner(false);
    }
  }, [isOpen]);

  const getPlaceholder = () => {
    switch (inputType) {
      case 'email': return 'customer@example.com';
      case 'phone': return '+1234567890';
      default: return '0x...';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-primary" />
            Earn Points
          </DialogTitle>
          <DialogDescription>
            Scan QR, enter email/phone, or wallet — rate is set by customer's tier.
          </DialogDescription>
        </DialogHeader>

        {showScanner ? (
          <div className="space-y-3 sm:space-y-4 mt-3 sm:mt-4">
            <div className="flex items-center justify-between">
              <Label>Scan Customer's QR Code</Label>
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowScanner(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="relative aspect-square w-full max-w-sm mx-auto overflow-hidden rounded-lg border-2">
              <QrReader
                onResult={handleScan}
                constraints={{ facingMode: 'environment' }}
                containerStyle={{ width: '100%', height: '100%' }}
                videoStyle={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Position the QR code within the frame
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4 mt-3 sm:mt-4">
            {/* Step 1: Customer identifier */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Customer</Label>
                <div className="flex gap-1.5">
                  {!resolvedAddress && recipientInput && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleLookupCustomer}
                      disabled={isResolving || !recipientInput}
                      className="h-9 px-3"
                    >
                      {isResolving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Look up'}
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="default"
                    onClick={() => setShowScanner(true)}
                    className="h-9 px-3 border-primary/50 text-primary hover:bg-primary/10"
                  >
                    <QrCode className="h-4 w-4 mr-1.5" />
                    Scan QR
                  </Button>
                </div>
              </div>
              
              <Tabs value={inputType} onValueChange={(v) => { setInputType(v as any); setRecipientInput(''); setResolvedAddress(null); setTierInfo(null); }}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="wallet" className="text-xs gap-1">
                    <Wallet className="h-3 w-3" /> Wallet
                  </TabsTrigger>
                  <TabsTrigger value="email" className="text-xs gap-1">
                    <Mail className="h-3 w-3" /> Email
                  </TabsTrigger>
                  <TabsTrigger value="phone" className="text-xs gap-1">
                    <Phone className="h-3 w-3" /> Phone
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              <Input
                placeholder={getPlaceholder()}
                value={recipientInput}
                onChange={e => { setRecipientInput(e.target.value); setResolvedAddress(null); setTierInfo(null); }}
                disabled={isPending || isResolving}
                type={inputType === 'email' ? 'email' : inputType === 'phone' ? 'tel' : 'text'}
              />

              {/* Customer tier badge */}
              {isFetchingTier && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Looking up customer tier...
                </div>
              )}
              {resolvedAddress && tierInfo && (
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge
                    variant="outline"
                    className="text-xs border"
                    style={{ borderColor: tierInfo.badgeColor, color: tierInfo.badgeColor }}
                  >
                    <Star className="h-3 w-3 mr-1" />
                    {tierInfo.tierName}
                  </Badge>
                  {tierInfo.cashbackMultiplier > 1 && (
                    <span className="text-xs text-muted-foreground">
                      ×{tierInfo.cashbackMultiplier} cashback multiplier
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    ({resolvedAddress.slice(0, 6)}...{resolvedAddress.slice(-4)})
                  </span>
                </div>
              )}
            </div>

            {/* Step 2: Purchase amount */}
            <div className="space-y-2">
              <Label htmlFor="earn-purchase">Purchase Amount ($)</Label>
              <Input
                id="earn-purchase"
                type="number"
                min="0"
                step="0.01"
                placeholder="e.g. 50.00"
                value={purchaseAmount}
                onChange={e => setPurchaseAmount(e.target.value)}
                disabled={isPending || isResolving || !resolvedAddress}
              />
              {!resolvedAddress && recipientInput && (
                <p className="text-xs text-muted-foreground">
                  Look up the customer first to determine their tier and cashback rate
                </p>
              )}
            </div>

            {/* Auto-calculated tokens (read-only rates) */}
            <div className="p-4 rounded-lg border bg-muted/50 space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Shield className="h-4 w-4" />
                <span>Rates locked by program settings</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calculator className="h-4 w-4" />
                Base: {cashbackRate}%
                {tierInfo && tierInfo.cashbackMultiplier > 1 && (
                  <> × {tierInfo.cashbackMultiplier} ({tierInfo.tierName}) = {effectiveCashbackRate.toFixed(1)}%</>
                )}
                {' · '}{pointsPerDollar} pts/$1
              </div>
              {purchaseAmount && parseFloat(purchaseAmount) > 0 && resolvedAddress && (
                <p className="text-xs text-muted-foreground">
                  ${purchaseAmount} × {effectiveCashbackRate.toFixed(1)}% = ${cashbackDollars.toFixed(2)} × {pointsPerDollar} = {tokensToEarn}
                </p>
              )}
              <div className="text-lg font-bold text-primary">
                +{tokensToEarn} {programSymbol}
              </div>
              <p className="text-xs text-muted-foreground">
                Tokens to be credited to the customer
              </p>
            </div>

            <Button
              type="submit"
              disabled={isPending || isResolving || !resolvedAddress || !purchaseAmount || parseFloat(tokensToEarn) <= 0}
              className="w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90"
            >
              {isResolving ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Looking up customer...</>
              ) : (
                isPending ? 'Processing...' : `Credit ${tokensToEarn} ${programSymbol}`
              )}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
