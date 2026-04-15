import { MerchantDashboard } from '@/components/crm/MerchantDashboard';
import { RFMSegmentation } from '@/components/crm/RFMSegmentation';

export function DashboardTab() {
  return (
    <div className="space-y-6">
      <MerchantDashboard />
      <RFMSegmentation />
    </div>
  );
}
