import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, TrendingUp, Users, Zap, Target } from "lucide-react";

interface AutomationAnalyticsProps {
  programs: any[];
  selectedProgram: string;
  onProgramChange: (program: string) => void;
}

export const AutomationAnalytics = ({ programs, selectedProgram, onProgramChange }: AutomationAnalyticsProps) => {
  const { address } = useAccount();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalTriggers: 0,
    successRate: 0,
    activeRules: 0,
    customersReached: 0,
    offersByType: {} as Record<string, number>,
  });

  useEffect(() => {
    if (address && selectedProgram) {
      loadAnalytics();
    }
  }, [address, selectedProgram]);

  const loadAnalytics = async () => {
    if (!address || !selectedProgram) return;

    setLoading(true);

    // Load trigger history
    const { data: history } = await supabase
      .from("automation_triggers_history")
      .select("*, automation_rules(rule_type)")
      .eq("merchant_address", address.toLowerCase());

    // Load active rules
    const { data: rules } = await supabase
      .from("automation_rules")
      .select("*")
      .eq("merchant_address", address.toLowerCase())
      .eq("token_address", selectedProgram)
      .eq("is_active", true);

    if (history) {
      const successCount = history.filter((h) => h.success).length;
      const uniqueCustomers = new Set(history.map((h) => h.customer_address)).size;
      
      const offersByType: Record<string, number> = {};
      history.forEach((h) => {
        const ruleType = h.automation_rules?.rule_type || "unknown";
        offersByType[ruleType] = (offersByType[ruleType] || 0) + 1;
      });

      setStats({
        totalTriggers: history.length,
        successRate: history.length > 0 ? (successCount / history.length) * 100 : 0,
        activeRules: rules?.length || 0,
        customersReached: uniqueCustomers,
        offersByType,
      });
    }

    setLoading(false);
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
              <CardTitle>Automation Analytics</CardTitle>
              <CardDescription>Track the performance of your automation rules</CardDescription>
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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Triggers</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalTriggers}</div>
            <p className="text-xs text-muted-foreground">
              Automation actions executed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.successRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              Successfully completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Rules</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeRules}</div>
            <p className="text-xs text-muted-foreground">
              Currently running
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Customers Reached</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.customersReached}</div>
            <p className="text-xs text-muted-foreground">
              Unique customers
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Triggers by Rule Type</CardTitle>
          <CardDescription>Breakdown of automation actions by type</CardDescription>
        </CardHeader>
        <CardContent>
          {Object.keys(stats.offersByType).length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No data available yet
            </p>
          ) : (
            <div className="space-y-4">
              {Object.entries(stats.offersByType).map(([type, count]) => (
                <div key={type} className="flex items-center justify-between">
                  <span className="text-sm font-medium capitalize">
                    {type.replace(/_/g, " ")}
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary"
                        style={{
                          width: `${(count / stats.totalTriggers) * 100}%`,
                        }}
                      />
                    </div>
                    <span className="text-sm text-muted-foreground w-12 text-right">
                      {count}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
