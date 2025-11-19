import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Trash2, Activity, TrendingUp, Gift, Clock, Cake } from "lucide-react";
import { toast } from "sonner";

interface AutomationRulesListProps {
  programs: any[];
  selectedProgram: string;
  onProgramChange: (program: string) => void;
}

const ruleTypeIcons: Record<string, any> = {
  at_risk_offer: TrendingUp,
  tier_upgrade: Activity,
  voucher_expiring: Clock,
  inactive_reminder: Gift,
  birthday_bonus: Cake,
};

const ruleTypeLabels: Record<string, string> = {
  at_risk_offer: "At-Risk Customer Offers",
  tier_upgrade: "Tier Upgrade Congratulations",
  voucher_expiring: "Voucher Expiring Reminders",
  inactive_reminder: "Inactive Customer Reminders",
  birthday_bonus: "Birthday Bonuses",
};

export const AutomationRulesList = ({ programs, selectedProgram, onProgramChange }: AutomationRulesListProps) => {
  const { address } = useAccount();
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (address && selectedProgram) {
      loadRules();
    }
  }, [address, selectedProgram]);

  const loadRules = async () => {
    if (!address || !selectedProgram) return;

    setLoading(true);
    const { data, error } = await supabase
      .from("automation_rules")
      .select("*")
      .eq("merchant_address", address.toLowerCase())
      .eq("token_address", selectedProgram)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setRules(data);
    }
    setLoading(false);
  };

  const toggleRule = async (ruleId: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from("automation_rules")
      .update({ is_active: !currentStatus })
      .eq("id", ruleId);

    if (error) {
      toast.error("Failed to update rule");
    } else {
      toast.success(currentStatus ? "Rule disabled" : "Rule enabled");
      loadRules();
    }
  };

  const deleteRule = async (ruleId: string) => {
    if (!confirm("Are you sure you want to delete this automation rule?")) return;

    const { error } = await supabase
      .from("automation_rules")
      .delete()
      .eq("id", ruleId);

    if (error) {
      toast.error("Failed to delete rule");
    } else {
      toast.success("Rule deleted successfully");
      loadRules();
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Automation Rules</CardTitle>
              <CardDescription>Manage your automated marketing rules</CardDescription>
            </div>
            <Select value={selectedProgram} onValueChange={onProgramChange}>
              <SelectTrigger className="w-[250px]">
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
        </CardHeader>
      </Card>

      {rules.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            No automation rules created yet. Create your first rule to automate your marketing!
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {rules.map((rule) => {
            const Icon = ruleTypeIcons[rule.rule_type] || Activity;
            return (
              <Card key={rule.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">
                          {ruleTypeLabels[rule.rule_type] || rule.rule_type}
                        </CardTitle>
                        <CardDescription className="mt-1">
                          {rule.action_config.description || "Automated marketing rule"}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={rule.is_active ? "default" : "secondary"}>
                        {rule.is_active ? "Active" : "Inactive"}
                      </Badge>
                      <Switch
                        checked={rule.is_active}
                        onCheckedChange={() => toggleRule(rule.id, rule.is_active)}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteRule(rule.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {rule.action_config.discount_percentage && (
                      <div>
                        <span className="text-muted-foreground">Discount:</span>{" "}
                        <span className="font-medium">{rule.action_config.discount_percentage}%</span>
                      </div>
                    )}
                    {rule.action_config.bonus_tokens && (
                      <div>
                        <span className="text-muted-foreground">Bonus Tokens:</span>{" "}
                        <span className="font-medium">{rule.action_config.bonus_tokens}</span>
                      </div>
                    )}
                    {rule.trigger_condition.days_inactive && (
                      <div>
                        <span className="text-muted-foreground">Inactive Days:</span>{" "}
                        <span className="font-medium">{rule.trigger_condition.days_inactive}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
