import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AutomationRulesList } from "./AutomationRulesList";
import { CreateAutomationRule } from "./CreateAutomationRule";
import { AutomationHistory } from "./AutomationHistory";
import { AutomationAnalytics } from "./AutomationAnalytics";
import { Loader2 } from "lucide-react";

export const AutomationDashboard = () => {
  const { address } = useAccount();
  const [loading, setLoading] = useState(true);
  const [programs, setPrograms] = useState<any[]>([]);
  const [selectedProgram, setSelectedProgram] = useState<string>("");

  useEffect(() => {
    if (address) {
      loadPrograms();
    }
  }, [address]);

  const loadPrograms = async () => {
    if (!address) return;
    
    setLoading(true);
    const { data, error } = await supabase
      .from("loyalty_programs")
      .select("*")
      .eq("merchant_address", address.toLowerCase())
      .eq("status", "active");

    if (!error && data) {
      setPrograms(data);
      if (data.length > 0 && !selectedProgram) {
        setSelectedProgram(data[0].token_address);
      }
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (programs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Automation Dashboard</CardTitle>
          <CardDescription>
            You need to have an active loyalty program to use automation features.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Automation Dashboard</CardTitle>
          <CardDescription>
            Manage automated marketing rules and track their performance
          </CardDescription>
        </CardHeader>
      </Card>

      <Tabs defaultValue="rules" className="space-y-6">
        <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0 pb-2">
          <TabsList className="inline-flex w-auto min-w-full">
            <TabsTrigger value="rules" className="flex-shrink-0 text-xs px-2 sm:px-3 md:px-4 md:text-sm whitespace-nowrap">Rules</TabsTrigger>
            <TabsTrigger value="create" className="flex-shrink-0 text-xs px-2 sm:px-3 md:px-4 md:text-sm whitespace-nowrap">Create Rule</TabsTrigger>
            <TabsTrigger value="history" className="flex-shrink-0 text-xs px-2 sm:px-3 md:px-4 md:text-sm whitespace-nowrap">History</TabsTrigger>
            <TabsTrigger value="analytics" className="flex-shrink-0 text-xs px-2 sm:px-3 md:px-4 md:text-sm whitespace-nowrap">Analytics</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="rules">
          <AutomationRulesList
            programs={programs}
            selectedProgram={selectedProgram}
            onProgramChange={setSelectedProgram}
          />
        </TabsContent>

        <TabsContent value="create">
          <CreateAutomationRule
            programs={programs}
            selectedProgram={selectedProgram}
            onProgramChange={setSelectedProgram}
            onRuleCreated={loadPrograms}
          />
        </TabsContent>

        <TabsContent value="history">
          <AutomationHistory
            programs={programs}
            selectedProgram={selectedProgram}
            onProgramChange={setSelectedProgram}
          />
        </TabsContent>

        <TabsContent value="analytics">
          <AutomationAnalytics
            programs={programs}
            selectedProgram={selectedProgram}
            onProgramChange={setSelectedProgram}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};
