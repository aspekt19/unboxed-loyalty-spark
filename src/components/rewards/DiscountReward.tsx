import { useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { toast } from "sonner";
import { Percent } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { AuthPrompt } from "@/components/AuthPrompt";
import { useAuth } from "@/contexts/AuthContext";
import { useMerchantPrograms } from "@/hooks/useMerchantPrograms";
import { createReward, getMerchantRewards, updateReward } from "@/lib/vouchers";
import { supabase } from "@/integrations/supabase/client";

const DISCOUNT_DESCRIPTION = "Percentage off the order";

export function DiscountReward() {
  const { address } = useAccount();
  const { user } = useAuth();
  const { data: programRows = [] } = useMerchantPrograms(address, { activeOnly: true });
  const programs = useMemo(
    () =>
      programRows
        .filter((program) => program.token_address)
        .map((program) => ({
          address: program.token_address as string,
          name: program.name,
          symbol: program.symbol,
        })),
    [programRows],
  );
  const [tokenAddress, setTokenAddress] = useState("");
  const [percent, setPercent] = useState(5);
  const [cost, setCost] = useState(25);
  const [saving, setSaving] = useState(false);

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
          reward.description === DISCOUNT_DESCRIPTION,
      );
      if (!existing) return;
      const match = existing.name.match(/^(\d+)% off$/);
      if (match) setPercent(Number(match[1]));
      setCost(existing.cost);
    });
    return () => {
      cancelled = true;
    };
  }, [address, tokenAddress]);

  if (!address) return null;

  const symbol = programs.find((program) => program.address === tokenAddress)?.symbol ?? "tokens";

  const confirm = async () => {
    if (!user) {
      toast.error("Please sign in with your wallet first");
      return;
    }
    if (!tokenAddress) {
      toast.error("Select a loyalty program first");
      return;
    }
    setSaving(true);
    try {
      const { data: linked, error: linkError } = await supabase.rpc("is_current_user_linked_wallet", {
        p_wallet: address.toLowerCase(),
      });
      if (linkError || !linked) {
        toast.error("This wallet is not linked to your account. Please sign in again and try again.");
        return;
      }
      const name = `${percent}% off`;
      const existing = (await getMerchantRewards(address)).find(
        (reward) =>
          reward.tokenAddress.toLowerCase() === tokenAddress.toLowerCase() &&
          reward.description === DISCOUNT_DESCRIPTION,
      );
      const saved = existing
        ? await updateReward(existing.id, { name, description: DISCOUNT_DESCRIPTION, cost }, tokenAddress)
        : await createReward({
            tokenAddress,
            merchantAddress: address,
            name,
            description: DISCOUNT_DESCRIPTION,
            cost,
            isActive: true,
          });
      if (!saved) {
        toast.error("Could not save the discount.");
        return;
      }
      toast.success(`${name} is live for ${cost} ${symbol}.`);
      window.dispatchEvent(new Event("rewardsUpdated"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Percent className="h-5 w-5 text-primary" />
          Discount
        </CardTitle>
        <CardDescription>
          One percentage discount for this program. Set the percent and the point cost, then confirm.
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
              {programs.map((program) => (
                <SelectItem key={program.address} value={program.address}>
                  {program.name} ({program.symbol})
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
          <Label htmlFor="discount-cost">{cost} {symbol}</Label>
          <Slider
            id="discount-cost"
            min={5}
            max={100}
            step={5}
            value={[cost]}
            onValueChange={([value]) => setCost(value)}
          />
        </div>
        <Button type="button" className="w-full" disabled={!user || saving} onClick={confirm}>
          Confirm
        </Button>
      </CardContent>
    </Card>
  );
}
