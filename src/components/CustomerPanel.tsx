import { useState } from 'react';
import { TokenList } from './TokenList';
import { DexIntegration } from './DexIntegration';
import { RewardsSelection } from './rewards/RewardsSelection';
import { MyVouchers } from './rewards/MyVouchers';
import { CustomerTiersSection } from './tiers/CustomerTiersSection';
import { PersonalizedOffers } from './marketing/PersonalizedOffers';
import { ReferralCard } from './referral/ReferralCard';
import { CustomerReviewsSection } from './reviews/CustomerReviewsSection';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAccount } from 'wagmi';
import { Wallet } from 'lucide-react';

export function CustomerPanel() {
  const { address } = useAccount();
  const [selectedProgram, setSelectedProgram] = useState<{
    tokenAddress: string;
    tokenSymbol: string;
    programName: string;
  } | null>(null);

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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-1 space-y-6">
        <TokenList onSelectProgram={setSelectedProgram} selectedProgram={selectedProgram} />
        
        <ReferralCard />
      </div>
      
      <div className="lg:col-span-2 space-y-6">
        <CustomerTiersSection selectedProgram={selectedProgram} />
        
        <PersonalizedOffers />
        
        <RewardsSelection />
        
        <MyVouchers />
        
        <CustomerReviewsSection />
        
        <DexIntegration />
      </div>
    </div>
  );
}
