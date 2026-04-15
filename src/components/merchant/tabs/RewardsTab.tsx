import { CreateReward } from '@/components/rewards/CreateReward';
import { RewardsList } from '@/components/rewards/RewardsList';
import { VouchersManagement } from '@/components/rewards/VouchersManagement';

export function RewardsTab() {
  return (
    <div className="space-y-6">
      <CreateReward />
      <RewardsList />
      <VouchersManagement />
    </div>
  );
}
