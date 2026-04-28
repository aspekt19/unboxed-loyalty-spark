import { useState } from "react";
import { useAccount } from "wagmi";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

interface CreateAutomationRuleProps {
  programs: any[];
  selectedProgram: string;
  onProgramChange: (program: string) => void;
  onRuleCreated: () => void;
}

export const CreateAutomationRule = ({
  programs,
  selectedProgram,
  onProgramChange,
  onRuleCreated,
}: CreateAutomationRuleProps) => {
  const { address } = useAccount();
  const [ruleType, setRuleType] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [discountPercentage, setDiscountPercentage] = useState("");
  const [bonusTokens, setBonusTokens] = useState("");
  const [daysInactive, setDaysInactive] = useState("");
  const [usdAmount, setUsdAmount] = useState("");
  const [maxRedemptionPercent, setMaxRedemptionPercent] = useState("");
  const [expiresInDays, setExpiresInDays] = useState("");
  const [autoSend, setAutoSend] = useState(false);
  const [audience, setAudience] = useState<"all" | "rfm" | "tier">("all");
  const [rfmSegment, setRfmSegment] = useState<string>("new_customer");
  const [tierLevel, setTierLevel] = useState<string>("1");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address || !selectedProgram || !ruleType) {
      toast.error("Please fill in all required fields");
      return;
    }

    setLoading(true);

    const triggerCondition: any = {};
    if (daysInactive) {
      triggerCondition.days_inactive = parseInt(daysInactive);
    }

    const actionConfig: any = {
      title: title || undefined,
      description: description || undefined,
    };

    if (discountPercentage) {
      actionConfig.discount_percentage = parseInt(discountPercentage);
    }
    if (bonusTokens) {
      actionConfig.bonus_tokens = parseInt(bonusTokens);
    }
    if (ruleType === "welcome_gift_certificate") {
      if (usdAmount) actionConfig.usd_amount = parseFloat(usdAmount);
      if (maxRedemptionPercent) actionConfig.max_redemption_percent = parseInt(maxRedemptionPercent);
      if (expiresInDays) actionConfig.expires_in_days = parseInt(expiresInDays);
      actionConfig.audience = audience;
      if (audience === "rfm") actionConfig.rfm_segment = rfmSegment;
      if (audience === "tier") actionConfig.min_tier_level = parseInt(tierLevel);
    }

    // Welcome certs require explicit opt-in via the auto-send switch.
    // Other rules default to active on creation.
    const isActive = ruleType === "welcome_gift_certificate" ? autoSend : true;

    const { error } = await supabase.from("automation_rules").insert({
      merchant_address: address.toLowerCase(),
      token_address: selectedProgram,
      rule_type: ruleType,
      is_active: isActive,
      trigger_condition: triggerCondition,
      action_config: actionConfig,
    });

    setLoading(false);

    if (error) {
      toast.error("Failed to create automation rule");
      console.error(error);
    } else {
      toast.success("Automation rule created successfully!");
      setRuleType("");
      setTitle("");
      setDescription("");
      setDiscountPercentage("");
      setBonusTokens("");
      setDaysInactive("");
      setUsdAmount("");
      setMaxRedemptionPercent("");
      setExpiresInDays("");
      setAutoSend(false);
      setAudience("all");
      setRfmSegment("new_customer");
      setTierLevel("1");
      const successMsg = ruleType === "welcome_gift_certificate" && !autoSend
        ? "Rule saved as inactive. Toggle 'Active' in the rules list when ready."
        : "Automation rule created successfully!";
      toast.success(successMsg);
      onRuleCreated();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Automation Rule</CardTitle>
        <CardDescription>
          Set up automated marketing actions for your loyalty program
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="program">Loyalty Program</Label>
            <Select value={selectedProgram} onValueChange={onProgramChange}>
              <SelectTrigger id="program">
                <SelectValue placeholder="Select program" />
              </SelectTrigger>
              <SelectContent>
                {programs.map((program) => (
                  <SelectItem key={program.token_address} value={program.token_address}>
                    {program.name} ({program.symbol})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ruleType">Rule Type</Label>
            <Select value={ruleType} onValueChange={setRuleType}>
              <SelectTrigger id="ruleType">
                <SelectValue placeholder="Select rule type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="at_risk_offer">At-Risk Customer Offers</SelectItem>
                <SelectItem value="tier_upgrade">Tier Upgrade Congratulations</SelectItem>
                <SelectItem value="inactive_reminder">Inactive Customer Reminders</SelectItem>
                <SelectItem value="welcome_gift_certificate">Welcome Gift Certificate (auto-issue to new customers)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Offer Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Special Offer for You!"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Offer Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the offer details..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="discount">Discount Percentage</Label>
              <Input
                id="discount"
                type="number"
                min="0"
                max="100"
                value={discountPercentage}
                onChange={(e) => setDiscountPercentage(e.target.value)}
                placeholder="15"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bonusTokens">Bonus Tokens</Label>
              <Input
                id="bonusTokens"
                type="number"
                min="0"
                value={bonusTokens}
                onChange={(e) => setBonusTokens(e.target.value)}
                placeholder="50"
              />
            </div>
          </div>

          {ruleType === "inactive_reminder" && (
            <div className="space-y-2">
              <Label htmlFor="daysInactive">Days Inactive</Label>
              <Input
                id="daysInactive"
                type="number"
                min="1"
                value={daysInactive}
                onChange={(e) => setDaysInactive(e.target.value)}
                placeholder="60"
              />
              <p className="text-sm text-muted-foreground">
                Trigger this rule for customers inactive for this many days
              </p>
            </div>
          )}

          {ruleType === "welcome_gift_certificate" && (
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="usdAmount">Certificate Value (USD)</Label>
                <Input
                  id="usdAmount"
                  type="number"
                  min="1"
                  step="0.01"
                  value={usdAmount}
                  onChange={(e) => setUsdAmount(e.target.value)}
                  placeholder="10"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxPct">Max % off purchase</Label>
                <Input
                  id="maxPct"
                  type="number"
                  min="5"
                  max="100"
                  value={maxRedemptionPercent}
                  onChange={(e) => setMaxRedemptionPercent(e.target.value)}
                  placeholder="50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expDays">Valid for (days)</Label>
                <Input
                  id="expDays"
                  type="number"
                  min="1"
                  value={expiresInDays}
                  onChange={(e) => setExpiresInDays(e.target.value)}
                  placeholder="90"
                />
              </div>
              <p className="col-span-3 text-xs text-muted-foreground">
                A unique certificate will be auto-issued (every hour) to qualifying customers who had activity in the last 24h. Mint button appears in your Certificates tab once they redeem.
              </p>
            </div>
          )}

          {ruleType === "welcome_gift_certificate" && (
            <div className="space-y-4 rounded-lg border border-border bg-muted/30 p-4">
              <div className="space-y-2">
                <Label>Audience</Label>
                <Select value={audience} onValueChange={(v) => setAudience(v as "all" | "rfm" | "tier")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All new customers (last 24h activity)</SelectItem>
                    <SelectItem value="rfm">By RFM segment</SelectItem>
                    <SelectItem value="tier">By minimum tier level</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {audience === "rfm" && (
                <div className="space-y-2">
                  <Label>RFM Segment</Label>
                  <Select value={rfmSegment} onValueChange={setRfmSegment}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new_customer">New Customers</SelectItem>
                      <SelectItem value="champions">Champions</SelectItem>
                      <SelectItem value="loyal">Loyal</SelectItem>
                      <SelectItem value="at_risk">At Risk</SelectItem>
                      <SelectItem value="lost">Lost</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {audience === "tier" && (
                <div className="space-y-2">
                  <Label>Minimum Tier Level</Label>
                  <Input
                    type="number"
                    min="1"
                    value={tierLevel}
                    onChange={(e) => setTierLevel(e.target.value)}
                  />
                </div>
              )}

              <div className="flex items-start justify-between gap-4 rounded-md border border-border bg-background p-3">
                <div className="space-y-1">
                  <Label htmlFor="autoSend" className="text-sm font-medium">
                    Enable automatic sending
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Off by default. Turn on only after you've reviewed the value, audience and expiration above. You can pause anytime from the rules list.
                  </p>
                </div>
                <Switch id="autoSend" checked={autoSend} onCheckedChange={setAutoSend} />
              </div>
            </div>
          )}

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Creating..." : "Create Automation Rule"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
