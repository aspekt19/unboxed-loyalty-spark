import { useState } from 'react';
import { TokenList } from './TokenList';
import { DexIntegration } from './DexIntegration';
import { RewardsSelection } from './rewards/RewardsSelection';
import { MyVouchers } from './rewards/MyVouchers';
import { CustomerTiersSection } from './tiers/CustomerTiersSection';
import { PersonalizedOffers } from './marketing/PersonalizedOffers';
import { ReferralCard } from './referral/ReferralCard';
import { ReferralCodeInput } from './referral/ReferralCodeInput';
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
      <PersonalizedOffers />
      
      <CustomerTiersSection selectedProgram={selectedProgram} />
      
      <TokenList 
        selectedProgram={selectedProgram}
        onProgramSelect={setSelectedProgram}
      />
      
      <RewardsSelection />
      
      <MyVouchers />
      
      <ReferralCodeInput />
      
      <ReferralCard />
      
      <CustomerReviewsSection />
      
      <DexIntegration />
    </div>
  );
}
