import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { QrReader } from '@blackbox-vision/react-qr-reader';
import { QrCode, X, Calculator, Coins, Mail, Phone, Wallet, Loader2 } from 'lucide-react';
import { useResolveRecipient } from '@/hooks/useResolveRecipient';
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
}

export function EarnPointsDialog({
  isOpen,
  onClose,
  onSubmit,
  isPending,
  cashbackRate,
  pointsPerDollar,
  programSymbol,
}: EarnPointsDialogProps) {
  const [recipientInput, setRecipientInput] = useState('');
  const [purchaseAmount, setPurchaseAmount] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [inputType, setInputType] = useState<'wallet' | 'email' | 'phone'>('wallet');
  const { resolveRecipient, isResolving } = useResolveRecipient();

  const cashbackDollars = purchaseAmount
    ? (parseFloat(purchaseAmount) * (cashbackRate / 100))
    : 0;
  const tokensToEarn = purchaseAmount
    ? (cashbackDollars * pointsPerDollar).toFixed(2)
    : '0';

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!recipientInput || !purchaseAmount || parseFloat(tokensToEarn) <= 0) return;
      
      const walletAddress = await resolveRecipient(recipientInput);
      if (!walletAddress) return;
      
      onSubmit(walletAddress, tokensToEarn);
      setRecipientInput('');
      setPurchaseAmount('');
      setShowScanner(false);
    },
    [recipientInput, purchaseAmount, tokensToEarn, onSubmit, resolveRecipient],
  );

  const handleScan = useCallback((result: any) => {
    if (result?.text) {
      setRecipientInput(result.text);
      setInputType('wallet');
      setShowScanner(false);
    }
  }, []);

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
            Scan QR, enter email/phone, or wallet — tokens are calculated automatically.
          </DialogDescription>
        </DialogHeader>

        {showScanner ? (
          <div className="space-y-4 mt-4">
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
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            {/* Step 1: Customer identifier */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Customer</Label>
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
              
              <Tabs value={inputType} onValueChange={(v) => { setInputType(v as any); setRecipientInput(''); }}>
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
                onChange={e => setRecipientInput(e.target.value)}
                disabled={isPending || isResolving}
                type={inputType === 'email' ? 'email' : inputType === 'phone' ? 'tel' : 'text'}
              />
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
                disabled={isPending || isResolving}
              />
            </div>

            {/* Auto-calculated tokens */}
            <div className="p-4 rounded-lg border bg-muted/50 space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calculator className="h-4 w-4" />
                Cashback rate: {cashbackRate}%
              </div>
              <div className="text-lg font-bold text-primary">
                +{tokensToEarn} {programSymbol}
              </div>
              <p className="text-xs text-muted-foreground">
                Tokens to be credited to the customer
              </p>
            </div>

            <Button
              type="submit"
              disabled={isPending || isResolving || !recipientInput || !purchaseAmount || parseFloat(tokensToEarn) <= 0}
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
