import { useState } from 'react';
import { TokenList } from './TokenList';
import { RewardsSelection } from './rewards/RewardsSelection';
import { MyVouchers } from './rewards/MyVouchers';
import { CustomerTiersSection } from './tiers/CustomerTiersSection';
import { PersonalizedOffers } from './marketing/PersonalizedOffers';
import { ReferralCard } from './referral/ReferralCard';
import { ReferralCodeInput } from './referral/ReferralCodeInput';
import { CustomerReviewsSection } from './reviews/CustomerReviewsSection';
import { WalletQRCode } from './WalletQRCode';
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
      {/* Step 1: Show QR - primary action */}
      <WalletQRCode />
      
      <PersonalizedOffers />
      
      <CustomerTiersSection selectedProgram={selectedProgram} />
      
      {/* Step 2: View earned tokens by merchant */}
      <TokenList 
        selectedProgram={selectedProgram}
        onProgramSelect={setSelectedProgram}
      />
      
      {/* Step 3: Activate a reward */}
      <RewardsSelection />
      
      {/* Step 4: View activated vouchers */}
      <MyVouchers />
      
      <ReferralCodeInput />
      
      <ReferralCard />
      
      <CustomerReviewsSection />
    </div>
  );
}
