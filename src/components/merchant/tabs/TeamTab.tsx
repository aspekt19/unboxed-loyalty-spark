import { BranchManagement } from '@/components/team/BranchManagement';
import { EmployeeManagement } from '@/components/team/EmployeeManagement';

export function TeamTab() {
  return (
    <div className="space-y-6">
      <BranchManagement />
      <EmployeeManagement />
    </div>
  );
}
