import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

export type BillingCycle = 'monthly' | 'annual';

/**
 * Annual discount per plan slug (mirrors the same map in the
 * verify-agent-plan-payment edge function — keep in sync).
 */
export function annualDiscountPercent(slug: string | null | undefined): number {
  const s = (slug || '').toLowerCase();
  if (s === 'growth' || s === 'scale' || s === 'enterprise') return 20;
  if (s === 'starter' || s === 'pro') return 15;
  return 0;
}

/** USD amount the user must send for the chosen cycle, rounded to cents. */
export function priceForCycle(
  monthlyPrice: number,
  cycle: BillingCycle,
  slug: string | null | undefined,
): number {
  if (cycle !== 'annual') return Number(monthlyPrice);
  const discount = annualDiscountPercent(slug);
  const gross = Number(monthlyPrice) * 12;
  return Math.round(gross * (1 - discount / 100) * 100) / 100;
}

/** Effective monthly price under the chosen cycle (for "$X/mo billed annually"). */
export function effectiveMonthlyPrice(
  monthlyPrice: number,
  cycle: BillingCycle,
  slug: string | null | undefined,
): number {
  if (cycle !== 'annual') return Number(monthlyPrice);
  return Math.round((priceForCycle(monthlyPrice, 'annual', slug) / 12) * 100) / 100;
}

interface BillingCycleToggleProps {
  value: BillingCycle;
  onChange: (cycle: BillingCycle) => void;
  className?: string;
  /** Discount label shown next to the Annual tab, e.g. "Save up to 20%". */
  discountLabel?: string;
}

export function BillingCycleToggle({
  value,
  onChange,
  className,
  discountLabel = 'Save 15–20%',
}: BillingCycleToggleProps) {
  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as BillingCycle)} className={className}>
      <TabsList>
        <TabsTrigger value="monthly" className="text-xs sm:text-sm">
          Monthly
        </TabsTrigger>
        <TabsTrigger value="annual" className="text-xs sm:text-sm gap-2">
          Annual
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            {discountLabel}
          </Badge>
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
