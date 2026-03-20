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

interface MobileProfileTabProps {
  onUpgrade: () => void;
}

export function MobileProfileTab({ onUpgrade }: MobileProfileTabProps) {
  const { address } = useAccount();

  if (!address) {
    return (
      <Alert>
        <Wallet className="h-4 w-4" />
        <AlertDescription>
          Please connect your wallet to view your profile
        </AlertDescription>
      </Alert>
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
