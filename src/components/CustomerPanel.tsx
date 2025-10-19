import { TokenList } from './TokenList';
import { DexIntegration } from './DexIntegration';
import { RewardsSelection } from './rewards/RewardsSelection';
import { MyVouchers } from './rewards/MyVouchers';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CONTRACTS } from '@/config/contracts';
import { useAccount } from 'wagmi';
import { Wallet } from 'lucide-react';

export function CustomerPanel() {
  const { address } = useAccount();

  if (!address) {
    return (
      <Alert>
        <Wallet className="h-4 w-4" />
        <AlertDescription>
          Please connect your wallet to access the customer panel
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <TokenList />
      
      <DexIntegration tokenAddress={CONTRACTS.LOYAL_SPARK_ERC20.address} />
      
      <RewardsSelection />
      
      <MyVouchers />
    </div>
  );
}
