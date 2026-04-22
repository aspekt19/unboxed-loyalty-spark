import { useState, useEffect, useMemo } from 'react';
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
import { useMultiTokenBalance, type TokenInfo } from '@/hooks/useMultiTokenBalance';
import { supabase } from '@/integrations/supabase/client';
import { WalletMismatchBanner } from './identity/WalletMismatchBanner';

interface CustomerPanelProps {
  selectedMerchant: string | null;
  onMerchantSelect: (address: string) => void;
  onClearMerchantFilter?: () => void;
}

export function CustomerPanel({ selectedMerchant, onMerchantSelect, onClearMerchantFilter }: CustomerPanelProps) {
  const { address } = useAccount();
  const { user, session, isLoading } = useAuth();
  const [selectedProgram, setSelectedProgram] = useState<string | null>(null);
  const [allPrograms, setAllPrograms] = useState<TokenInfo[]>([]);

  // Load all active programs to compute owned-merchants set
  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('loyalty_programs')
        .select('token_address, name, symbol, merchant_address')
        .in('status', ['active', 'expiring_soon', 'paused']);
      if (cancelled || error || !data) return;
      setAllPrograms(
        data.map(p => ({
          address: p.token_address,
          name: p.name,
          symbol: p.symbol,
          merchantAddress: p.merchant_address,
        })),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [address]);

  const { balances } = useMultiTokenBalance(allPrograms);

  const ownedMerchantAddresses = useMemo(() => {
    const set = new Set<string>();
    for (const b of balances) {
      if (b.rawBalance > 0n && b.merchantAddress) {
        set.add(b.merchantAddress.toLowerCase());
      }
    }
    return set;
  }, [balances]);

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
      <WalletMismatchBanner />

      {/* Browse merchants — only those whose tokens user owns */}
      <MerchantCardGrid
        onMerchantSelect={handleMerchantSelect}
        selectedMerchant={selectedMerchant}
        restrictToMerchants={ownedMerchantAddresses}
      />

      <PersonalizedOffers />

      {/* View earned tokens with inline tier status */}
      <TokenList
        selectedProgram={selectedProgram}
        onProgramSelect={setSelectedProgram}
        filterByMerchant={selectedMerchant}
        onClearMerchantFilter={onClearMerchantFilter}
      />

      {/* Activate a reward */}
      <RewardsSelection filterByMerchant={selectedMerchant} />

      {/* View activated vouchers */}
      <MyVouchers />
    </div>
  );
}
