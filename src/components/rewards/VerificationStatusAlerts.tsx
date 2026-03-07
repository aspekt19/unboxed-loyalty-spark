/**
 * UI alerts for voucher verification status:
 * - Verifying in progress
 * - Verification pending (retry)
 * - Legacy failed attempt (recovery)
 */

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, X, AlertCircle, Gift } from 'lucide-react';
import type { VerificationStatus, FailedVoucherAttempt } from '@/hooks/useVoucherVerification';

interface VerificationStatusAlertsProps {
  verification: VerificationStatus;
  failedAttempt: FailedVoucherAttempt | null;
  isRecovering: boolean;
  onRecover: () => void;
  onDismiss: () => void;
}

export function VerificationStatusAlerts({
  verification,
  failedAttempt,
  isRecovering,
  onRecover,
  onDismiss,
}: VerificationStatusAlertsProps) {
  return (
    <>
      {/* Verification in progress */}
      {verification.isVerifying && (
        <Alert className="border-primary/50 bg-primary/10">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <AlertDescription>
            <div className="space-y-2">
              <p className="font-semibold text-primary">Verifying Transaction...</p>
              <p className="text-sm text-muted-foreground">
                Please wait while we confirm your payment on the blockchain.
              </p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Attempt {verification.attempt} of {verification.maxAttempts}</span>
                <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-primary h-full transition-all duration-500"
                    style={{ width: `${(verification.attempt / verification.maxAttempts) * 100}%` }}
                  />
                </div>
              </div>
              {verification.rewardName && (
                <p className="text-xs">
                  <span className="font-medium">Reward:</span> {verification.rewardName}
                </p>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Verification pending – retry option */}
      {!verification.isVerifying && verification.canRetry && failedAttempt && (
        <Alert className="border-amber-500/50 bg-amber-500/10">
          <RefreshCw className="h-4 w-4 text-amber-600" />
          <div className="flex flex-col gap-3">
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-semibold text-amber-700 dark:text-amber-400">
                  Verification Pending
                </p>
                <p className="text-sm text-muted-foreground">
                  Your payment was sent but verification is taking longer than expected.
                  The blockchain may need a few more seconds to process.
                </p>
                <div className="space-y-1 text-xs">
                  <p><span className="font-medium">Reward:</span> {failedAttempt.rewardName}</p>
                  <p><span className="font-medium">Cost:</span> {failedAttempt.cost} tokens</p>
                </div>
              </div>
            </AlertDescription>
            <div className="flex gap-2">
              <Button
                onClick={onRecover}
                disabled={isRecovering}
                size="sm"
                variant="default"
                className="flex-1"
              >
                {isRecovering ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Retry Now
                  </>
                )}
              </Button>
              <Button onClick={onDismiss} size="sm" variant="ghost">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Alert>
      )}

      {/* Legacy recovery alert */}
      {failedAttempt && !verification.canRetry && !verification.isVerifying && (
        <Alert variant="destructive" className="border-destructive/50 bg-destructive/10 relative">
          <button
            onClick={onDismiss}
            className="absolute top-2 right-2 text-destructive hover:text-destructive/80 transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
          <AlertCircle className="h-4 w-4" />
          <div className="flex flex-col gap-3 pr-6">
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-semibold">Voucher Creation Failed</p>
                <p className="text-sm">
                  Your tokens were successfully transferred, but the voucher couldn't be created.
                </p>
                <div className="space-y-1 text-xs">
                  <p><span className="font-medium">Reward:</span> {failedAttempt.rewardName}</p>
                  <p><span className="font-medium">Cost:</span> {failedAttempt.cost} tokens</p>
                  <p className="break-all">
                    <span className="font-medium">Transaction:</span> {failedAttempt.hash}
                  </p>
                </div>
              </div>
            </AlertDescription>
            <Button
              onClick={onRecover}
              disabled={isRecovering}
              size="sm"
              variant="default"
              className="w-full"
            >
              {isRecovering ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Recovering Voucher...
                </>
              ) : (
                <>
                  <Gift className="mr-2 h-4 w-4" />
                  Recover My Voucher
                </>
              )}
            </Button>
          </div>
        </Alert>
      )}
    </>
  );
}
