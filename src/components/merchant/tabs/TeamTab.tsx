import { BranchManagement } from '@/components/team/BranchManagement';
import { EmployeeManagement } from '@/components/team/EmployeeManagement';
import { AcceptMerchantInviteCard } from '@/components/team/AcceptMerchantInviteCard';

export function TeamTab() {
  return (
    <div className="space-y-6">
      {/* Accept invite code to join another merchant's team */}
      <AcceptMerchantInviteCard />

      {/* Own team management — any merchant can create branches and employees */}
      <BranchManagement />
      <EmployeeManagement />
    </div>
  );
}
