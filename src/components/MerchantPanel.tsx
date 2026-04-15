import { supabase } from '@/integrations/supabase/client';
import { DashboardTab } from './merchant/tabs/DashboardTab';
import { CustomersTab } from './merchant/tabs/CustomersTab';
import { ProgramsTab } from './merchant/tabs/ProgramsTab';
import { RewardsTab } from './merchant/tabs/RewardsTab';
import { MarketingTab } from './merchant/tabs/MarketingTab';
import { AgentsTab } from './merchant/tabs/AgentsTab';
import { TeamTab } from './merchant/tabs/TeamTab';
import { useState, useEffect } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useMintTokens } from '@/hooks/useMintTokens';
import { useAccount } from 'wagmi';
import { toast } from 'sonner';
import { Wallet, Bot, Users } from 'lucide-react';
import { useCheckProgramStatus } from '@/hooks/useCheckProgramStatus';
import { mintTokensSchema } from '@/lib/validationSchemas';

export function MerchantPanel() {
  const { address } = useAccount();
  const [selectedProgram, setSelectedProgram] = useState<{ name: string; symbol: string; tokenAddress: string; cashbackRate?: number; pointsPerDollar?: number } | null>(null);
  const [mintDialogOpen, setMintDialogOpen] = useState(false);
  const [earnDialogOpen, setEarnDialogOpen] = useState(false);
  const [lastMintParams, setLastMintParams] = useState<{ recipient: string; amount: string } | null>(null);
  
  const { mintTokens, isPending, isSuccess, reset, hash } = useMintTokens();
  const { isPaused, isMintingActive } = useCheckProgramStatus(
    selectedProgram?.tokenAddress as `0x${string}` | undefined
  );

  useEffect(() => {
    if (!address) {
      setSelectedProgram(null);
      setMintDialogOpen(false);
    }
  }, [address]);

  const handleMintSubmit = async (recipientAddress: string, amount: string) => {
    if (!selectedProgram) {
      toast.error('Please select a loyalty program first');
      return;
    }
    if (isPaused || !isMintingActive) {
      toast.error('Please activate the program first before issuing tokens');
      return;
    }
    if (!recipientAddress || !amount) {
      toast.error('Please fill all fields');
      return;
    }
    const validation = mintTokensSchema.safeParse({
      recipientAddress: recipientAddress.trim(),
      amount: amount.trim(),
      tokenAddress: selectedProgram.tokenAddress,
    });
    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }
    setLastMintParams({ recipient: recipientAddress.trim(), amount: amount.trim() });
    await mintTokens(selectedProgram.tokenAddress, recipientAddress, amount);
  };

  useEffect(() => {
    if (isSuccess && selectedProgram && address && lastMintParams) {
      supabase
        .from('token_mint_history')
        .insert({
          merchant_address: address.toLowerCase(),
          recipient_address: lastMintParams.recipient.toLowerCase(),
          amount: parseFloat(lastMintParams.amount),
          token_address: selectedProgram.tokenAddress.toLowerCase(),
          token_name: selectedProgram.name,
          token_symbol: selectedProgram.symbol,
          transaction_hash: hash || null,
        })
        .then(({ error: insertError }) => {
          if (insertError) console.error('[MerchantPanel] Failed to save mint history:', insertError);
        });

      toast.success('Tokens minted successfully!');
      setMintDialogOpen(false);
      setLastMintParams(null);
      window.dispatchEvent(new Event('loyaltyProgramsUpdated'));
      window.dispatchEvent(new Event('tokenBalancesUpdated'));
      window.dispatchEvent(new Event('tokensIssued'));
      setTimeout(() => reset(), 2000);
    }
  }, [isSuccess, reset, selectedProgram, address, lastMintParams, hash]);

  if (!address) {
    return (
      <Alert>
        <Wallet className="h-4 w-4" />
        <AlertDescription>Please connect your wallet to access the merchant panel</AlertDescription>
      </Alert>
    );
  }

  return (
    <Tabs defaultValue="dashboard" className="w-full">
      <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0 pb-2">
        <TabsList className="inline-flex w-auto min-w-full">
          <TabsTrigger value="dashboard" className="flex-shrink-0 text-xs px-2 sm:px-3 md:px-4 md:text-sm whitespace-nowrap">Dashboard</TabsTrigger>
          <TabsTrigger value="customers" className="flex-shrink-0 text-xs px-2 sm:px-3 md:px-4 md:text-sm whitespace-nowrap">Customers</TabsTrigger>
          <TabsTrigger value="programs" className="flex-shrink-0 text-xs px-2 sm:px-3 md:px-4 md:text-sm whitespace-nowrap">Programs</TabsTrigger>
          <TabsTrigger value="rewards" className="flex-shrink-0 text-xs px-2 sm:px-3 md:px-4 md:text-sm whitespace-nowrap">Rewards</TabsTrigger>
          <TabsTrigger value="marketing" className="flex-shrink-0 text-xs px-2 sm:px-3 md:px-4 md:text-sm whitespace-nowrap">Marketing</TabsTrigger>
          <TabsTrigger value="agents" className="flex-shrink-0 text-xs px-2 sm:px-3 md:px-4 md:text-sm whitespace-nowrap">
            <Bot className="h-3.5 w-3.5 mr-1" />AI Agents
          </TabsTrigger>
          <TabsTrigger value="team" className="flex-shrink-0 text-xs px-2 sm:px-3 md:px-4 md:text-sm whitespace-nowrap">
            <Users className="h-3.5 w-3.5 mr-1" />Team
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="dashboard" className="mt-6">
        <DashboardTab />
      </TabsContent>
      <TabsContent value="customers" className="mt-6">
        <CustomersTab />
      </TabsContent>
      <TabsContent value="programs" className="mt-6">
        <ProgramsTab
          selectedProgram={selectedProgram}
          onSelectProgram={setSelectedProgram}
          mintDialogOpen={mintDialogOpen}
          setMintDialogOpen={setMintDialogOpen}
          earnDialogOpen={earnDialogOpen}
          setEarnDialogOpen={setEarnDialogOpen}
          handleMintSubmit={handleMintSubmit}
          isPending={isPending}
          isPaused={isPaused}
          isMintingActive={isMintingActive}
        />
      </TabsContent>
      <TabsContent value="rewards" className="mt-6">
        <RewardsTab />
      </TabsContent>
      <TabsContent value="marketing" className="mt-6">
        <MarketingTab
          selectedProgram={selectedProgram}
          merchantAddress={address.toLowerCase()}
        />
      </TabsContent>
      <TabsContent value="agents" className="mt-6">
        <AgentsTab />
      </TabsContent>
      <TabsContent value="team" className="mt-6">
        <TeamTab />
      </TabsContent>
    </Tabs>
  );
}
