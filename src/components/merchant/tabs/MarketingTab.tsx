import { TierManagement } from '@/components/tiers/TierManagement';
import { CreateCampaign } from '@/components/marketing/CreateCampaign';
import { CampaignList } from '@/components/marketing/CampaignList';
import { AutomationDashboard } from '@/components/automation/AutomationDashboard';
import { ReferralStats } from '@/components/referral/ReferralStats';
import { ReferralManagement } from '@/components/referral/ReferralManagement';
import { ReviewsList } from '@/components/reviews/ReviewsList';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

interface MarketingTabProps {
  selectedProgram: { tokenAddress: string } | null;
  merchantAddress: string;
}

export function MarketingTab({ selectedProgram, merchantAddress }: MarketingTabProps) {
  return (
    <div className="space-y-6">
      <TierManagement />
      <CreateCampaign />
      <CampaignList />
      <AutomationDashboard />
      <ReferralStats />
      <ReferralManagement />
      {selectedProgram ? (
        <ReviewsList
          tokenAddress={selectedProgram.tokenAddress}
          merchantAddress={merchantAddress}
          isMerchant={true}
        />
      ) : (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Please select a loyalty program in the Programs tab to view reviews
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
