import { AgentReportsDashboard } from '@/components/agents/AgentReportsDashboard';
import { AgentManagement } from '@/components/agents/AgentManagement';
import { AgentBillingDashboard } from '@/components/agents/AgentBillingDashboard';

export function AgentsTab() {
  return (
    <div className="space-y-6">
      <AgentReportsDashboard />
      <AgentManagement />
      <AgentBillingDashboard />
    </div>
  );
}
