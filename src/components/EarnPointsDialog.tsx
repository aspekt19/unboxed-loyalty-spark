import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { QrReader } from '@blackbox-vision/react-qr-reader';
import { QrCode, X, Calculator, Coins } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface EarnPointsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (recipientAddress: string, tokensToMint: string) => void;
  isPending: boolean;
  cashbackRate: number;
  programSymbol: string;
}

export function EarnPointsDialog({
  isOpen,
  onClose,
  onSubmit,
  isPending,
  cashbackRate,
  programSymbol,
}: EarnPointsDialogProps) {
  const [recipientAddress, setRecipientAddress] = useState('');
  const [purchaseAmount, setPurchaseAmount] = useState('');
  const [showScanner, setShowScanner] = useState(false);

  const tokensToEarn = purchaseAmount
    ? (parseFloat(purchaseAmount) * (cashbackRate / 100)).toFixed(2)
    : '0';

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!recipientAddress || !purchaseAmount || parseFloat(tokensToEarn) <= 0) return;
      onSubmit(recipientAddress, tokensToEarn);
      setRecipientAddress('');
      setPurchaseAmount('');
      setShowScanner(false);
    },
    [recipientAddress, purchaseAmount, tokensToEarn, onSubmit],
  );

  const handleScan = useCallback((result: any) => {
    if (result?.text) {
      setRecipientAddress(result.text);
      setShowScanner(false);
    }
  }, []);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-primary" />
            Earn Points
          </DialogTitle>
          <DialogDescription>
            Scan customer's QR code, enter purchase amount — tokens are calculated automatically.
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
            {/* Step 1: Customer address */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="earn-recipient">Customer Wallet</Label>
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
              <Input
                id="earn-recipient"
                placeholder="0x..."
                value={recipientAddress}
                onChange={e => setRecipientAddress(e.target.value)}
                disabled={isPending}
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
                disabled={isPending}
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
              disabled={isPending || !recipientAddress || !purchaseAmount || parseFloat(tokensToEarn) <= 0}
              className="w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90"
            >
              {isPending ? 'Processing...' : `Credit ${tokensToEarn} ${programSymbol}`}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
