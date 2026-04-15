import { BranchManagement } from '@/components/team/BranchManagement';
import { EmployeeManagement } from '@/components/team/EmployeeManagement';
import { AcceptMerchantInviteCard } from '@/components/team/AcceptMerchantInviteCard';

export function TeamTab() {
  return (
    <div className="space-y-6">
      <AcceptMerchantInviteCard />
      <BranchManagement />
      <EmployeeManagement />
    </div>
  );
}
