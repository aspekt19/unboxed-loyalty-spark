import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { createReward, getMerchantRewards, updateReward } from "@/lib/vouchers";
import { discountDescription, formatUsd, isPresetDiscount } from "@/lib/discountReward";
import { supabase } from "@/integrations/supabase/client";

export function useSaveDiscountReward(address: string | undefined) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);

  const save = async (input: {
    tokenAddress: string;
    percent: number;
    cost: number;
    cap: number;
    symbol: string;
  }) => {
    if (!address) return;
    if (!user) {
      toast.error("Please sign in with your wallet first");
      return;
    }
    if (!input.tokenAddress) {
      toast.error("Select a loyalty program first");
      return;
    }
    if (!Number.isFinite(input.cost) || input.cost <= 0) {
      toast.error("Enter a point cost above 0");
      return;
    }
    if (!Number.isFinite(input.cap) || input.cap <= 0) {
      toast.error("Enter the largest order this discount can cover");
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
      const name = `${input.percent}% off`;
      const description = discountDescription(input.cap);
      const existing = (await getMerchantRewards(address)).find(
        (reward) =>
          reward.tokenAddress.toLowerCase() === input.tokenAddress.toLowerCase() &&
          reward.name === name &&
          isPresetDiscount(reward),
      );
      const saved = existing
        ? await updateReward(existing.id, { name, description, cost: input.cost }, input.tokenAddress)
        : await createReward({
            tokenAddress: input.tokenAddress,
            merchantAddress: address,
            name,
            description,
            cost: input.cost,
            isActive: true,
          });
      if (!saved) {
        toast.error("Could not save the discount.");
        return;
      }
      toast.success(`${name} is live for ${input.cost} ${input.symbol}, up to $${formatUsd(input.cap)}.`);
      window.dispatchEvent(new Event("rewardsUpdated"));
    } finally {
      setSaving(false);
    }
  };

  return { save, saving };
}
