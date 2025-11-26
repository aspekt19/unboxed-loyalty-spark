import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { usePremiumStatus } from '@/hooks/usePremiumStatus';
import { usePremiumPayment } from '@/hooks/usePremiumPayment';
import { Wallet, CheckCircle2, Loader2 } from 'lucide-react';
import { useAccount } from 'wagmi';
import { formatUnits } from 'viem';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface PremiumUpgradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const PremiumUpgradeDialog = ({ open, onOpenChange }: PremiumUpgradeDialogProps) => {
  const { address } = useAccount();
  const { paymentSettings } = usePremiumStatus();
  const { 
    handlePayment, 
    isSending, 
    isConfirming, 
    isPaymentConfirmed,
    usdcBalance,
    hasEnoughBalance,
    isCreatingRequest
  } = usePremiumPayment(address, paymentSettings?.admin_wallet_address);

  const handleUpgrade = () => {
    handlePayment(paymentSettings?.usdc_price || 10);
  };

  const isProcessing = isSending || isConfirming || isCreatingRequest;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Upgrade to Premium</DialogTitle>
          <DialogDescription>
            Get access to Compound Lending Plus with 6-10% APY returns
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Payment Status */}
          {isPaymentConfirmed ? (
            <Alert className="border-green-500/50 bg-green-500/10">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <AlertDescription className="text-green-700 dark:text-green-400">
                Payment submitted! An admin will verify your transaction shortly.
              </AlertDescription>
            </Alert>
          ) : null}

          {/* Wallet Balance */}
          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Your USDC Balance</span>
              </div>
              <span className="text-sm font-semibold">
                {usdcBalance ? formatUnits(usdcBalance, 6) : '0'} USDC
              </span>
            </div>

            {!hasEnoughBalance && (
              <Alert variant="destructive">
                <AlertDescription>
                  Insufficient USDC balance. You need at least 10 USDC to upgrade to Premium.
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Pricing Info */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Premium Subscription</span>
              <span className="text-lg font-bold">{paymentSettings?.usdc_price || 10} USDC</span>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>✓ Valid for 30 days</p>
              <p>✓ 6-10% APY with Compound strategy</p>
              <p>✓ Advanced analytics dashboard</p>
              <p>✓ Priority support</p>
            </div>
          </div>

          {/* Payment Button */}
          <Button 
            className="w-full h-12 text-base font-semibold"
            onClick={handleUpgrade}
            disabled={!hasEnoughBalance || isProcessing || !address}
            size="lg"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {isSending ? 'Confirm in wallet...' : isConfirming ? 'Confirming...' : 'Submitting...'}
              </>
            ) : (
              <>Pay {paymentSettings?.usdc_price || 10} USDC</>
            )}
          </Button>

          {/* Additional Info */}
          <div className="bg-primary/5 p-4 rounded-lg space-y-2 border border-primary/20">
            <p className="text-xs font-medium">How it works:</p>
            <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Click "Pay" and confirm the USDC transfer in your wallet</li>
              <li>Wait for blockchain confirmation</li>
              <li>An admin will verify your payment and activate premium</li>
            </ol>
          </div>

          {/* Get USDC Link */}
          {!hasEnoughBalance && (
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => window.open('https://app.uniswap.org/swap?chain=base&outputCurrency=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', '_blank')}
            >
              Get USDC on Base Network
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
