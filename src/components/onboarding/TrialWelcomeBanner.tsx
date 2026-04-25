import { useEffect, useState } from 'react';
import { useEffectivePlan, type PlanProduct } from '@/hooks/useEffectivePlan';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Gift, X, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAccount } from 'wagmi';

interface Props {
  product: PlanProduct;
}

/**
 * One-time welcome banner for new merchants/agents on their 45-day trial.
 * Explains what Trial includes and how to upgrade. Dismissible per wallet.
 */
export function TrialWelcomeBanner({ product }: Props) {
  const plan = useEffectivePlan(product);
  const { address } = useAccount();
  const storageKey = address
    ? `ls.trial-welcome-dismissed.${product}.${address.toLowerCase()}`
    : null;
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (!storageKey) return;
    setDismissed(localStorage.getItem(storageKey) === '1');
  }, [storageKey]);

  if (!plan.isTrial || plan.isAdminOverride || dismissed) return null;

  const handleDismiss = () => {
    if (storageKey) localStorage.setItem(storageKey, '1');
    setDismissed(true);
  };

  const upgradeHref =
    product === 'merchant' ? '/merchant?tab=billing' : '/pricing';
  const productLabel = product === 'merchant' ? 'Growth' : 'Pro';
  const featureLine =
    product === 'merchant'
      ? 'Marketing campaigns, automation rules, RFM segmentation, customer tiers and CRM analytics.'
      : 'Higher rate limits, more agents, full MCP toolset and lower transaction fees.';

  return (
    <Card className="relative border-accent/40 bg-gradient-to-br from-accent/10 via-primary/5 to-transparent mb-6">
      <button
        type="button"
        onClick={handleDismiss}
        className="absolute top-2 right-2 p-1 rounded-md hover:bg-background/60 text-muted-foreground"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
      <CardContent className="p-5 flex flex-col md:flex-row md:items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/20 shrink-0">
          <Gift className="h-6 w-6 text-accent-foreground" />
        </div>
        <div className="flex-1 space-y-1">
          <p className="font-semibold text-base">
            🎉 You're on a free 45-day {productLabel} trial
            {plan.daysRemaining != null ? ` · ${plan.daysRemaining} days left` : ''}
          </p>
          <p className="text-sm text-muted-foreground">
            Full access to {featureLine} No card required, no auto-charge — when
            the trial ends, paid features become read-only until you renew with
            USDC on Base. Save up to 20% on annual plans.
          </p>
        </div>
        <Button asChild size="sm" variant="default" className="shrink-0">
          <Link to={upgradeHref} className="gap-1">
            See plans <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
