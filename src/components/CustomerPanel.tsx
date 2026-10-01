import { useState, useEffect, useMemo } from 'react';
import { TokenList } from './TokenList';
import { RewardsSelection } from './rewards/RewardsSelection';
import { MyVouchers } from './rewards/MyVouchers';
import { PersonalizedOffers } from './marketing/PersonalizedOffers';
import { MerchantCardGrid } from './customer/MerchantCardGrid';
import { MyCertificates } from './certificates/MyCertificates';
import { LoyalSparkConcierge } from './assistant/LoyalSparkConcierge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAccount } from 'wagmi';
import { MessageSquare, Wallet } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { AuthPrompt } from './AuthPrompt';
import { useMultiTokenBalance, type TokenInfo } from '@/hooks/useMultiTokenBalance';
import { useActiveCustomerWallet } from '@/hooks/useActiveCustomerWallet';
import { useActiveLoyaltyPrograms } from '@/hooks/useActiveLoyaltyPrograms';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CustomerPanelProps {
  selectedMerchant: string | null;
  onMerchantSelect: (address: string) => void;
  onClearMerchantFilter?: () => void;
}

export function CustomerPanel({ selectedMerchant, onMerchantSelect, onClearMerchantFilter }: CustomerPanelProps) {
  const { address } = useAccount();
  const { activeAddress } = useActiveCustomerWallet();
  const { user, session, isLoading } = useAuth();
  const [selectedProgram, setSelectedProgram] = useState<string | null>(null);
  const [showSecondary, setShowSecondary] = useState(false);
  const [showAssistant, setShowAssistant] = useState(false);

  const { data: programs = [], isLoading: programsLoading } = useActiveLoyaltyPrograms();

  const allPrograms: TokenInfo[] = useMemo(
    () =>
      programs.map((p) => ({
        address: p.token_address,
        name: p.name,
        symbol: p.symbol,
        merchantAddress: p.merchant_address,
      })),
    [programs],
  );

  const { balances, isLoading: balancesLoading } = useMultiTokenBalance(allPrograms, activeAddress);

  const ownedMerchantAddresses = useMemo(() => {
    const set = new Set<string>();
    for (const b of balances) {
      if (b.rawBalance > 0n && b.merchantAddress) {
        set.add(b.merchantAddress.toLowerCase());
      }
    }
    return set;
  }, [balances]);

  // Paint tokens/rewards first; defer merchant grid / offers / certificates.
  useEffect(() => {
    if (!session || !activeAddress) {
      setShowSecondary(false);
      return;
    }
    if (!programsLoading && !balancesLoading) {
      const t = window.setTimeout(() => setShowSecondary(true), 0);
      return () => window.clearTimeout(t);
    }
    const fallback = window.setTimeout(() => setShowSecondary(true), 1200);
    return () => window.clearTimeout(fallback);
  }, [session, activeAddress, programsLoading, balancesLoading]);

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
      <div className="rounded-xl border border-border bg-card/50 p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <MessageSquare className="h-4 w-4 shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">Shopper assistant</p>
              <p className="text-xs text-muted-foreground truncate">Loyal Spark only — balances, rewards, vouchers</p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowAssistant((v) => !v)}
          >
            {showAssistant ? "Hide" : "Ask"}
          </Button>
        </div>
        <div className={cn("mt-3", !showAssistant && "hidden")}>
          <LoyalSparkConcierge role="shopper" title="Shopper Concierge" className="h-[min(60vh,480px)] border-0 shadow-none" />
        </div>
      </div>

      {showSecondary ? (
        <MerchantCardGrid
          onMerchantSelect={handleMerchantSelect}
          selectedMerchant={selectedMerchant}
          restrictToMerchants={ownedMerchantAddresses}
        />
      ) : null}

      {/* Primary loyalty loop — shared programs/balances cache */}
      <TokenList
        selectedProgram={selectedProgram}
        onProgramSelect={setSelectedProgram}
        filterByMerchant={selectedMerchant}
        onClearMerchantFilter={onClearMerchantFilter}
      />

      <RewardsSelection filterByMerchant={selectedMerchant} />

      <MyVouchers />

      {showSecondary ? (
        <>
          <PersonalizedOffers />
          <MyCertificates />
        </>
      ) : null}
    </div>
  );
}
