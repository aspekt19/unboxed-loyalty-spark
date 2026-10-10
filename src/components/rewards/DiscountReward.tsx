import { useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { Percent } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AuthPrompt } from "@/components/AuthPrompt";
import { useAuth } from "@/contexts/AuthContext";
import { useMerchantPrograms } from "@/hooks/useMerchantPrograms";
import { useSaveDiscountReward } from "@/hooks/useSaveDiscountReward";
import { getMerchantRewards } from "@/lib/vouchers";
import { breakEvenOrderUsd, formatUsd, isPresetDiscount, parseDiscountCap } from "@/lib/discountReward";

export function DiscountReward() {
  const { address } = useAccount();
  const { user } = useAuth();
  const { save, saving } = useSaveDiscountReward(address);
  const { data: programRows = [] } = useMerchantPrograms(address, { activeOnly: true });
  const programs = useMemo(
    () =>
      programRows
        .filter((program) => program.token_address)
        .map((program) => ({
          address: program.token_address as string,
          name: program.name,
          symbol: program.symbol,
          pointsPerDollar: Number(program.points_per_dollar ?? 1),
        })),
    [programRows],
  );
  const [tokenAddress, setTokenAddress] = useState("");
  const [percent, setPercent] = useState(5);
  const [costInput, setCostInput] = useState("25");
  const [capInput, setCapInput] = useState("50");
  const [warnOpen, setWarnOpen] = useState(false);

  useEffect(() => {
    if (!tokenAddress && programs.length > 0) setTokenAddress(programs[0].address);
  }, [programs, tokenAddress]);

  useEffect(() => {
    if (!address || !tokenAddress) return;
    let cancelled = false;
    getMerchantRewards(address).then((rewards) => {
      if (cancelled) return;
      const existing = rewards.find(
        (reward) =>
          reward.tokenAddress.toLowerCase() === tokenAddress.toLowerCase() &&
          reward.name === `${percent}% off` &&
          isPresetDiscount(reward),
      );
      if (!existing) return;
      setCostInput(String(existing.cost));
      const cap = parseDiscountCap(existing.description);
      if (cap !== null) setCapInput(String(cap));
    });
    return () => {
      cancelled = true;
    };
  }, [address, tokenAddress, percent]);

  if (!address) return null;

  const program = programs.find((item) => item.address === tokenAddress);
  const symbol = program?.symbol ?? "tokens";
  const pointsPerDollar = program?.pointsPerDollar ?? 1;
  const cost = Number(costInput);
  const cap = Number(capInput);
  const fairUntil = breakEvenOrderUsd(percent, cost, pointsPerDollar);

  const confirm = () => {
    if (fairUntil !== null && cap > fairUntil) {
      setWarnOpen(true);
      return;
    }
    void save({ tokenAddress, percent, cost, cap, symbol }).then(() => setWarnOpen(false));
  };

  return (
    <Card className="border-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Percent className="h-5 w-5 text-primary" />
          Discount
        </CardTitle>
        <CardDescription>
          One discount per percent. Set the point cost and the largest order it can cover.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <AuthPrompt />
        <div className="space-y-2">
          <Label htmlFor="discount-program">Loyalty Program</Label>
          <Select value={tokenAddress} onValueChange={setTokenAddress}>
            <SelectTrigger id="discount-program">
              <SelectValue placeholder="Select a program" />
            </SelectTrigger>
            <SelectContent>
              {programs.map((item) => (
                <SelectItem key={item.address} value={item.address}>
                  {item.name} ({item.symbol})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="discount-percent">{percent}%</Label>
          <Slider
            id="discount-percent"
            min={1}
            max={100}
            step={1}
            value={[percent]}
            onValueChange={([value]) => setPercent(value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="discount-cost">Point cost</Label>
          <Input
            id="discount-cost"
            type="number"
            min="0.01"
            step="any"
            value={costInput}
            onChange={(event) => setCostInput(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="discount-cap">Largest order, $</Label>
          <Input
            id="discount-cap"
            type="number"
            min="0.01"
            step="any"
            value={capInput}
            onChange={(event) => setCapInput(event.target.value)}
          />
          {fairUntil !== null && (
            <p className="text-xs text-muted-foreground">
              At {pointsPerDollar} {symbol} per $1, {percent}% for {costInput || "0"} {symbol} stays fair up to ${formatUsd(fairUntil)}.
            </p>
          )}
        </div>
        <Button type="button" className="w-full" disabled={!user || saving} onClick={confirm}>
          Confirm
        </Button>
      </CardContent>
      <AlertDialog open={warnOpen} onOpenChange={setWarnOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>This limit gives the discount away</AlertDialogTitle>
            <AlertDialogDescription>
              {percent}% off costs {costInput || "0"} {symbol}. At {pointsPerDollar} {symbol} per $1, that stays fair up to ${fairUntil !== null ? formatUsd(fairUntil) : "0"}. A ${formatUsd(Number.isFinite(cap) ? cap : 0)} limit lets a larger order take more off than those points are worth.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Go back</AlertDialogCancel>
            <AlertDialogAction
              disabled={saving}
              onClick={(event) => {
                event.preventDefault();
                void save({ tokenAddress, percent, cost, cap, symbol }).then(() => setWarnOpen(false));
              }}
            >
              Save anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
