import { BranchManagement } from '@/components/team/BranchManagement';
import { EmployeeManagement } from '@/components/team/EmployeeManagement';
import { AcceptMerchantInviteCard } from '@/components/team/AcceptMerchantInviteCard';
import { MyTeamMembership } from '@/components/team/MyTeamMembership';

export function TeamTab() {
  return (
    <div className="space-y-6">
      {/* Show current team memberships (as employee of other merchants) */}
      <MyTeamMembership />

      {/* Accept invite code to join another merchant's team */}
      <AcceptMerchantInviteCard />

      {/* Own team management — any merchant can create branches and employees */}
      <BranchManagement />
      <EmployeeManagement />
    </div>
  );
}
