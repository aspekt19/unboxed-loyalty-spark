/** One percentage discount reward, identified by its name and this description. */

const CAP_PATTERN = /Applies to orders up to \$(\d+(?:\.\d+)?)/;

export function formatUsd(amount: number): string {
  return (Math.round(amount * 100) / 100).toString();
}

export function discountDescription(maxOrderUsd: number): string {
  return `Applies to orders up to $${formatUsd(maxOrderUsd)}. It does not apply above that amount.`;
}

export function parseDiscountCap(description: string | null | undefined): number | null {
  if (!description) return null;
  const match = description.match(CAP_PATTERN);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

export function isPresetDiscount(reward: { name: string; description: string | null }): boolean {
  return /^\d+% off$/.test(reward.name) && (
    reward.description === "Percentage off the order" || parseDiscountCap(reward.description) !== null
  );
}

/** Largest order where the percent off is still worth no more than the points. */
export function breakEvenOrderUsd(percent: number, pointCost: number, pointsPerDollar: number): number | null {
  if (percent <= 0 || pointCost <= 0 || pointsPerDollar <= 0) return null;
  return (pointCost / pointsPerDollar) * (100 / percent);
}

export function pointsForOrder(orderUsd: number, pointsPerDollar: number): number {
  return Math.round(orderUsd * pointsPerDollar * 10000) / 10000;
}
