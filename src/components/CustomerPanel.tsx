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

interface CustomerPanelProps {
  selectedMerchant: string | null;
  onMerchantSelect: (address: string) => void;
}

export function CustomerPanel({ selectedMerchant, onMerchantSelect }: CustomerPanelProps) {
  const { address } = useAccount();
  const { user, session, isLoading } = useAuth();
  const [selectedProgram, setSelectedProgram] = useState<string | null>(null);

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
    onMerchantSelect(merchantAddress);
  };

  return (
    <div className="space-y-6">
      <WalletQRCode />

      <MerchantCardGrid
        onMerchantSelect={handleMerchantSelect}
        selectedMerchant={selectedMerchant}
      />

      <PersonalizedOffers />

      <CustomerTiersSection selectedProgram={selectedProgram} />

      <TokenList
        selectedProgram={selectedProgram}
        onProgramSelect={setSelectedProgram}
        filterByMerchant={selectedMerchant}
      />

      <RewardsSelection filterByMerchant={selectedMerchant} />

      <MyVouchers />

      <ReferralCodeInput />
      <ReferralCard />
      <CustomerReviewsSection />
    </div>
  );
}
