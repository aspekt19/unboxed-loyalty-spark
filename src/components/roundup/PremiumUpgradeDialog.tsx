import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState } from 'react';
import { usePremiumStatus } from '@/hooks/usePremiumStatus';
import { Copy, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface PremiumUpgradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const PremiumUpgradeDialog = ({ open, onOpenChange }: PremiumUpgradeDialogProps) => {
  const { paymentSettings, createPaymentRequest, isCreatingRequest } = usePremiumStatus();
  const [transactionHash, setTransactionHash] = useState('');
  const [paymentType, setPaymentType] = useState<'usdc' | 'eth'>('usdc');

  const handleCopyAddress = () => {
    if (paymentSettings?.admin_wallet_address) {
      navigator.clipboard.writeText(paymentSettings.admin_wallet_address);
      toast.success('Address copied to clipboard!');
    }
  };

  const handleSubmitPayment = () => {
    if (!transactionHash) {
      toast.error('Please enter transaction hash');
      return;
    }

    createPaymentRequest({
      transactionHash,
      paymentType,
      amount: paymentSettings?.usdc_price || 10,
    });

    setTransactionHash('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Upgrade to Premium</DialogTitle>
          <DialogDescription>
            Get access to advanced investment strategies including Compound Lending Plus
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Payment Instructions */}
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium mb-2">Step 1: Send Payment</h4>
              <p className="text-sm text-muted-foreground mb-3">
                Send {paymentSettings?.usdc_price || 10} USDC or equivalent ETH to:
              </p>
              <div className="flex items-center gap-2">
                <Input
                  value={paymentSettings?.admin_wallet_address || ''}
                  readOnly
                  className="font-mono text-xs"
                />
                <Button
                  size="icon"
                  variant="outline"
                  onClick={handleCopyAddress}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Payment Type Selection */}
            <div className="space-y-2">
              <Label>Payment Type</Label>
              <Select value={paymentType} onValueChange={(value: 'usdc' | 'eth') => setPaymentType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="usdc">USDC</SelectItem>
                  <SelectItem value="eth">ETH (Equivalent)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Transaction Hash Input */}
            <div className="space-y-2">
              <Label htmlFor="txHash">Step 2: Enter Transaction Hash</Label>
              <Input
                id="txHash"
                placeholder="0x..."
                value={transactionHash}
                onChange={(e) => setTransactionHash(e.target.value)}
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">
                After sending the payment, paste your transaction hash here
              </p>
            </div>
          </div>

          {/* Submit Button */}
          <Button 
            className="w-full" 
            onClick={handleSubmitPayment}
            disabled={isCreatingRequest || !transactionHash}
          >
            {isCreatingRequest ? 'Submitting...' : 'Submit Payment Proof'}
          </Button>

          {/* Additional Info */}
          <div className="bg-muted/50 p-4 rounded-lg space-y-2">
            <p className="text-xs text-muted-foreground">
              • Your subscription will be activated after payment verification
            </p>
            <p className="text-xs text-muted-foreground">
              • Verification typically takes 1-24 hours
            </p>
            <p className="text-xs text-muted-foreground">
              • Premium access is valid for 30 days
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
