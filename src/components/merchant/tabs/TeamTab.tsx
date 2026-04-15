import { useQuery } from '@tanstack/react-query';
import { useAccount } from 'wagmi';
import { supabase } from '@/integrations/supabase/client';
import { BranchManagement } from '@/components/team/BranchManagement';
import { EmployeeManagement } from '@/components/team/EmployeeManagement';
import { AcceptMerchantInviteCard } from '@/components/team/AcceptMerchantInviteCard';
import { MyTeamMembership } from '@/components/team/MyTeamMembership';

export function TeamTab() {
  const { address } = useAccount();

  // Check if the current user owns any loyalty program (i.e. is a merchant owner)
  const { data: isOwner } = useQuery({
    queryKey: ['is-merchant-owner', address],
    queryFn: async () => {
      if (!address) return false;
      const { count } = await supabase
        .from('loyalty_programs')
        .select('id', { count: 'exact', head: true })
        .eq('merchant_address', address.toLowerCase());
      return (count ?? 0) > 0;
    },
    enabled: !!address,
  });

  return (
    <div className="space-y-6">
      {/* Always show team memberships if the user is an employee somewhere */}
      <MyTeamMembership />

      {/* Show invite code input for non-owners or anyone who might need it */}
      <AcceptMerchantInviteCard />

      {/* Only show management sections for merchant owners */}
      {isOwner && (
        <>
          <BranchManagement />
          <EmployeeManagement />
        </>
      )}
    </div>
  );
}
