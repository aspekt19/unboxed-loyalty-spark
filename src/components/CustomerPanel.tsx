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
  const [selectedProgram, setSelectedProgram] = useState<string | null>(null);

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
      <ReferralCard />
      
      <PersonalizedOffers />
      
      <div className="grid gap-6 lg:grid-cols-2">
        <TokenList 
          selectedProgram={selectedProgram}
          onProgramSelect={setSelectedProgram}
        />
        
        <CustomerTiersSection selectedProgram={selectedProgram} />
      </div>
      
      <RewardsSelection />
      
      <MyVouchers />
      
      <CustomerReviewsSection />
      
      <DexIntegration />
    </div>
  );
}
