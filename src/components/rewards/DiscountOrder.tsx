import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatUsd, parseDiscountCap, pointsForOrder } from "@/lib/discountReward";
import { Reward } from "@/types/rewards";

export function DiscountOrder({
  reward,
  symbol,
  pointsPerDollar,
  canPay,
  onGate,
  onPay,
}: {
  reward: Reward;
  symbol: string;
  pointsPerDollar: number;
  canPay: boolean;
  onGate: (blocked: boolean) => void;
  onPay: (points: number, orderUsd: number) => void;
}) {
  const cap = parseDiscountCap(reward.description);
  const [orderInput, setOrderInput] = useState("");
  const orderUsd = Number(orderInput);
  const hasOrder = orderInput.trim() !== "" && Number.isFinite(orderUsd) && orderUsd > 0;
  const overCap = cap !== null && hasOrder && orderUsd > cap;
  const points = hasOrder ? pointsForOrder(orderUsd, pointsPerDollar) : null;

  useEffect(() => {
    onGate(cap !== null && (!hasOrder || overCap));
  }, [cap, hasOrder, overCap, onGate]);

  if (cap === null) return null;

  return (
    <div className="space-y-2">
      <Label htmlFor="discount-order">Order amount, $</Label>
      <Input
        id="discount-order"
        type="number"
        min="0.01"
        step="any"
        value={orderInput}
        onChange={(event) => setOrderInput(event.target.value)}
        placeholder={`Up to $${formatUsd(cap)}`}
      />
      <p className="text-sm text-muted-foreground">
        {reward.name} applies to orders up to ${formatUsd(cap)}.
        {overCap && points !== null
          ? ` This order is higher, so the discount does not apply. Pay with points instead: ${points} ${symbol} at ${pointsPerDollar} ${symbol} per $1.`
          : ""}
      </p>
      {overCap && points !== null && (
        <Button type="button" className="w-full" variant="outline" disabled={!canPay} onClick={() => onPay(points, orderUsd)}>
          Pay {points} {symbol}
        </Button>
      )}
    </div>
  );
}
