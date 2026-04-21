import { useEffectivePlan, type PlanProduct } from '@/hooks/useEffectivePlan';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Crown, Clock, Sparkles, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Props {
  product: PlanProduct;
  /** Where to deep-link the upgrade CTA. */
  upgradeHref?: string;
}

/**
 * Compact plan status card for portal headers.
 * - Admin: shows "Admin · Full access".
 * - Trialing: shows days remaining + Upgrade CTA.
 * - Active paid: shows plan name + expiry.
 * - Expired / none: shows "Free" + Upgrade CTA (only for merchants/agents in their portals).
 */
export function PlanStatusBadge({ product, upgradeHref }: Props) {
  const plan = useEffectivePlan(product);

  if (plan.isLoading) return null;

  const defaultUpgrade =
    product === 'merchant' ? '/merchant?tab=billing' : '/pricing';
  const href = upgradeHref || defaultUpgrade;

  if (plan.isAdminOverride) {
    return (
      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10">
        <CardContent className="p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Crown className="h-5 w-5 text-primary" />
            </div>
            <div>
              <Badge variant="default" className="mb-1 gap-1">
                <Crown className="h-3 w-3" />
                Admin · Full access
              </Badge>
              <p className="text-xs text-muted-foreground">
                Bypassing all plan limits
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (plan.isTrial) {
    return (
      <Card className="border-accent/40 bg-gradient-to-br from-accent/10 to-accent/20">
        <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/20">
              <Sparkles className="h-5 w-5 text-accent-foreground" />
            </div>
            <div>
              <Badge variant="secondary" className="mb-1 gap-1">
                <Clock className="h-3 w-3" />
                Trial · {plan.name}
              </Badge>
              <p className="text-xs text-muted-foreground">
                {plan.daysRemaining != null
                  ? `${plan.daysRemaining} day${plan.daysRemaining === 1 ? '' : 's'} remaining`
                  : 'Trial active'}
              </p>
            </div>
          </div>
          <Button asChild size="sm" variant="default">
            <Link to={href}>Upgrade now</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (plan.isExpired) {
    return (
      <Card className="border-destructive/30 bg-destructive/5">
        <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <div>
              <p className="text-sm font-semibold">
                Your plan has expired
              </p>
              <p className="text-xs text-muted-foreground">
                Premium features are now read-only. Renew to restore access.
              </p>
            </div>
          </div>
          <Button asChild size="sm" variant="default">
            <Link to={href}>Renew plan</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (plan.hasPaidAccess) {
    return (
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
        <CardContent className="p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Crown className="h-5 w-5 text-primary" />
            </div>
            <div>
              <Badge variant="default" className="mb-1">{plan.name}</Badge>
              <p className="text-xs text-muted-foreground">
                {plan.expiresAt
                  ? `Renews ${new Date(plan.expiresAt).toLocaleDateString()}`
                  : 'Active subscription'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Free / no plan — only show CTA in merchant/agent portals
  return null;
}
