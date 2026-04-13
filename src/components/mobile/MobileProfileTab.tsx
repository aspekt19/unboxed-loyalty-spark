import { WalletQRCode } from '@/components/WalletQRCode';
import { PremiumStatusBadge } from '@/components/PremiumStatusBadge';
import { PremiumExpirationAlert } from '@/components/PremiumExpirationAlert';
import { ReferralCard } from '@/components/referral/ReferralCard';
import { ReferralCodeInput } from '@/components/referral/ReferralCodeInput';
import { CustomerReviewsSection } from '@/components/reviews/CustomerReviewsSection';
import { DexIntegration } from '@/components/DexIntegration';
import { useAccount } from 'wagmi';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Wallet } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { AuthPrompt } from '@/components/AuthPrompt';

interface MobileProfileTabProps {
  onUpgrade: () => void;
}

export function MobileProfileTab({ onUpgrade }: MobileProfileTabProps) {
  const { address } = useAccount();
  const { user, session, isLoading } = useAuth();

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
            Please sign in to view your profile
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PremiumStatusBadge />
      <PremiumExpirationAlert onUpgrade={onUpgrade} />
      <WalletQRCode />
      <ReferralCodeInput />
      <ReferralCard />
      <CustomerReviewsSection />
      <DexIntegration />
    </div>
  );
}
