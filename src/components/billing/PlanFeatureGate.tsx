import { ReactNode } from 'react';
import { useEffectivePlan, type PlanProduct } from '@/hooks/useEffectivePlan';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Lock, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Props {
  product: PlanProduct;
  /** Section name shown in the read-only banner. */
  feature: string;
  /** Where to deep-link the upgrade CTA. */
  upgradeHref?: string;
  children: ReactNode;
}

/**
 * Soft-block wrapper:
 *  - Admin / active paid plan / trialing → renders children fully interactive.
 *  - Expired or no plan → renders children inside a non-interactive, dimmed
 *    container with a "read-only" upgrade banner on top.
 *
 * This keeps existing dashboards visible (so users can review historical data)
 * but prevents new mutations until they renew.
 */
export function PlanFeatureGate({ product, feature, upgradeHref, children }: Props) {
  const plan = useEffectivePlan(product);

  if (plan.isLoading) return <>{children}</>;
  if (plan.hasPaidAccess) return <>{children}</>;

  const href =
    upgradeHref ||
    (product === 'merchant' ? '/merchant?tab=billing' : '/for-agents#agent-billing');

  return (
    <div className="space-y-3">
      <Alert className="border-accent/40 bg-accent/10">
        {plan.isExpired ? (
          <Lock className="h-4 w-4" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
        <AlertTitle className="flex items-center justify-between gap-3 flex-wrap">
          <span>
            {plan.isExpired
              ? `${feature} is read-only — your plan expired`
              : `${feature} requires a paid plan`}
          </span>
          <Button asChild size="sm" variant="default">
            <Link to={href}>{plan.isExpired ? 'Renew now' : 'Start trial / upgrade'}</Link>
          </Button>
        </AlertTitle>
        <AlertDescription className="text-xs">
          You can still view existing data. Creating, editing or sending will
          unlock once your subscription is active.
        </AlertDescription>
      </Alert>
      <div
        className="pointer-events-none opacity-60 select-none"
        aria-disabled="true"
      >
        {children}
      </div>
    </div>
  );
}
