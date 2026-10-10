import { CreateReward } from '@/components/rewards/CreateReward';
import { DiscountReward } from '@/components/rewards/DiscountReward';
import { RewardsList } from '@/components/rewards/RewardsList';
import { VouchersManagement } from '@/components/rewards/VouchersManagement';

export function RewardsTab() {
  return (
    <div className="space-y-6">
      <DiscountReward />
      <CreateReward />
      <RewardsList />
      <VouchersManagement />
    </div>
  );
}
