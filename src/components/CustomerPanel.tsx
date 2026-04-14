import { useState } from 'react';
import { TokenList } from './TokenList';
import { RewardsSelection } from './rewards/RewardsSelection';
import { MyVouchers } from './rewards/MyVouchers';
import { PersonalizedOffers } from './marketing/PersonalizedOffers';
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
      {/* Browse merchants */}
      <MerchantCardGrid 
        onMerchantSelect={handleMerchantSelect}
        selectedMerchant={selectedMerchant}
      />
      
      <PersonalizedOffers />
      
      {/* View earned tokens with inline tier status */}
      <TokenList 
        selectedProgram={selectedProgram}
        onProgramSelect={setSelectedProgram}
        filterByMerchant={selectedMerchant}
      />
      
      {/* Activate a reward */}
      <RewardsSelection filterByMerchant={selectedMerchant} />
      
      {/* View activated vouchers */}
      <MyVouchers />
    </div>
  );
}
