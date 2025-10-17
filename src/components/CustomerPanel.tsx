import { TokenList } from './TokenList';
import { DexIntegration } from './DexIntegration';
import { RewardsSelection } from './rewards/RewardsSelection';
import { MyVouchers } from './rewards/MyVouchers';
import { CONTRACTS } from '@/config/contracts';

export function CustomerPanel() {
  return (
    <div className="space-y-6">
      <TokenList />
      
      <DexIntegration tokenAddress={CONTRACTS.LOYAL_SPARK_ERC20.address} />
      
      <RewardsSelection />
      
      <MyVouchers />
    </div>
  );
}
