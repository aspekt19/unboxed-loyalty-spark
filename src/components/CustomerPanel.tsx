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
import { MerchantCardGrid } from './customer/MerchantCardGrid';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAccount } from 'wagmi';
import { Wallet } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { AuthPrompt } from './AuthPrompt';

export function CustomerPanel() {
  const { address } = useAccount();
  const { user, session, isLoading } = useAuth();
  const [selectedProgram, setSelectedProgram] = useState<string | null>(null);
  const [selectedMerchant, setSelectedMerchant] = useState<string | null>(null);

  if (isLoading) {
    return null;
  }

  if (!address || !user || !session) {
    return (
      <div className="space-y-4">
        <AuthPrompt />
        <Alert>
          <Wallet className="h-4 w-4" />
          <AlertDescription>
            Please sign in to access your rewards and loyalty balance
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const handleMerchantSelect = (merchantAddress: string) => {
    setSelectedMerchant(prev => prev === merchantAddress ? null : merchantAddress);
  };

  return (
    <div className="space-y-6">
      {/* Step 1: Show QR - primary action */}
      <WalletQRCode />
      
      {/* Browse merchants */}
      <MerchantCardGrid 
        onMerchantSelect={handleMerchantSelect}
        selectedMerchant={selectedMerchant}
      />
      
      <PersonalizedOffers />
      
      <CustomerTiersSection selectedProgram={selectedProgram} />
      
      {/* Step 2: View earned tokens by merchant */}
      <TokenList 
        selectedProgram={selectedProgram}
        onProgramSelect={setSelectedProgram}
        filterByMerchant={selectedMerchant}
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
