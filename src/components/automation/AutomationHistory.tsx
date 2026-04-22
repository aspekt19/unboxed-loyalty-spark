import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";

interface AutomationProgramOption {
  token_address: string;
  name: string;
  symbol?: string;
}

interface AutomationHistoryProps {
  programs: AutomationProgramOption[];
  selectedProgram: string;
  onProgramChange: (program: string) => void;
}

export const AutomationHistory = ({ programs, selectedProgram, onProgramChange }: AutomationHistoryProps) => {
  const { address } = useAccount();
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (address && selectedProgram) {
      loadHistory();
    }
  }, [address, selectedProgram]);

  const loadHistory = async () => {
    if (!address || !selectedProgram) return;

    setLoading(true);
    const { data, error } = await supabase
      .from("automation_triggers_history")
      .select(`
        *,
        automation_rules(rule_type)
      `)
      .eq("merchant_address", address.toLowerCase())
      .order("triggered_at", { ascending: false })
      .limit(50);

    if (!error && data) {
      setHistory(data);
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
              <CardTitle>Automation Trigger History</CardTitle>
              <CardDescription>View all automated actions triggered by your rules</CardDescription>
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

      {history.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            No automation history yet. Your automated rules will appear here once triggered.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {history.map((entry) => (
                <div key={entry.id} className="p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {entry.success ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-destructive" />
                        )}
                        <span className="font-medium">{entry.action_taken}</span>
                        <Badge variant="outline" className="ml-auto">
                          {entry.automation_rules?.rule_type || "Unknown"}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p>Customer: {entry.customer_address.slice(0, 6)}...{entry.customer_address.slice(-4)}</p>
                        <p>Triggered: {format(new Date(entry.triggered_at), "PPp")}</p>
                      </div>
                      {entry.result && (
                        <div className="mt-2 p-2 bg-muted rounded-md text-xs">
                          <pre className="overflow-x-auto">
                            {JSON.stringify(entry.result, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
