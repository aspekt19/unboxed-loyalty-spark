import { CreateLoyaltyProgram } from './CreateLoyaltyProgram';
import { CreatedPrograms } from './CreatedPrograms';
import { supabase } from '@/integrations/supabase/client';
import { CreateReward } from './rewards/CreateReward';
import { RewardsList } from './rewards/RewardsList';
import { VouchersManagement } from './rewards/VouchersManagement';
import { MintTokensDialog } from './MintTokensDialog';
import { EarnPointsDialog } from './EarnPointsDialog';
import { MerchantDashboard } from './crm/MerchantDashboard';
import { EnhancedAnalytics } from './crm/EnhancedAnalytics';
import { CustomerList } from './crm/CustomerList';
import { RFMSegmentation } from './crm/RFMSegmentation';
import { TierManagement } from './tiers/TierManagement';
import { CreateCampaign } from './marketing/CreateCampaign';
import { CampaignList } from './marketing/CampaignList';
import { ReferralManagement } from './referral/ReferralManagement';
import { ReferralStats } from './referral/ReferralStats';
import { ReviewsList } from './reviews/ReviewsList';
import { AutomationDashboard } from './automation/AutomationDashboard';
import { AgentManagement } from './agents/AgentManagement';
import { AgentBillingDashboard } from './agents/AgentBillingDashboard';
import { AgentReportsDashboard } from './agents/AgentReportsDashboard';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useMintTokens } from '@/hooks/useMintTokens';
import { useAccount } from 'wagmi';
import { toast } from 'sonner';
import { Coins, AlertCircle, Wallet, AlertTriangle, Bot, ShoppingCart } from 'lucide-react';
import { useCheckProgramStatus } from '@/hooks/useCheckProgramStatus';
import { mintTokensSchema } from '@/lib/validationSchemas';

export function MerchantPanel() {
  const { address } = useAccount();
  const [selectedProgram, setSelectedProgram] = useState<{ name: string; symbol: string; tokenAddress: string; cashbackRate?: number; pointsPerDollar?: number } | null>(null);
  const [mintDialogOpen, setMintDialogOpen] = useState(false);
  const [earnDialogOpen, setEarnDialogOpen] = useState(false);
  const [lastMintParams, setLastMintParams] = useState<{ recipient: string; amount: string } | null>(null);
  
  // Always call hooks in the same order, regardless of conditions
  const { mintTokens, isPending, isSuccess, reset, hash } = useMintTokens();
  const { isPaused, isMintingActive, isUtilityActive } = useCheckProgramStatus(
    selectedProgram?.tokenAddress as `0x${string}` | undefined
  );

  // Сбрасываем выбранную программу при отключении кошелька
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

    // Validate inputs using zod schema
    const validation = mintTokensSchema.safeParse({
      recipientAddress: recipientAddress.trim(),
      amount: amount.trim(),
      tokenAddress: selectedProgram.tokenAddress,
    });

    if (!validation.success) {
      const errorMessage = validation.error.errors[0].message;
      toast.error(errorMessage);
      console.error('[Validation Error]', validation.error.errors);
      return;
    }

    setLastMintParams({ recipient: recipientAddress.trim(), amount: amount.trim() });
    await mintTokens(selectedProgram.tokenAddress, recipientAddress, amount);
  };

  useEffect(() => {
    if (isSuccess && selectedProgram && address && lastMintParams) {
      // Save mint to DB
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
      setTimeout(() => {
        reset();
      }, 2000);
    }
  }, [isSuccess, reset, selectedProgram, address, lastMintParams, hash]);

  return (
    <div className="space-y-6">
      {!address ? (
        <Alert>
          <Wallet className="h-4 w-4" />
          <AlertDescription>
            Please connect your wallet to access the merchant panel
          </AlertDescription>
        </Alert>
      ) : (
        <Tabs defaultValue="dashboard" className="w-full">
          <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0 pb-2">
            <TabsList className="inline-flex w-auto min-w-full">
              <TabsTrigger value="dashboard" className="flex-shrink-0 text-xs px-2 sm:px-3 md:px-4 md:text-sm whitespace-nowrap">Dashboard</TabsTrigger>
              <TabsTrigger value="customers" className="flex-shrink-0 text-xs px-2 sm:px-3 md:px-4 md:text-sm whitespace-nowrap">Customers</TabsTrigger>
              <TabsTrigger value="programs" className="flex-shrink-0 text-xs px-2 sm:px-3 md:px-4 md:text-sm whitespace-nowrap">Programs</TabsTrigger>
              <TabsTrigger value="rewards" className="flex-shrink-0 text-xs px-2 sm:px-3 md:px-4 md:text-sm whitespace-nowrap">Rewards</TabsTrigger>
              <TabsTrigger value="tiers" className="flex-shrink-0 text-xs px-2 sm:px-3 md:px-4 md:text-sm whitespace-nowrap">Tiers</TabsTrigger>
              <TabsTrigger value="marketing" className="flex-shrink-0 text-xs px-2 sm:px-3 md:px-4 md:text-sm whitespace-nowrap">Marketing</TabsTrigger>
              <TabsTrigger value="referrals" className="flex-shrink-0 text-xs px-2 sm:px-3 md:px-4 md:text-sm whitespace-nowrap">Referrals</TabsTrigger>
              <TabsTrigger value="reviews" className="flex-shrink-0 text-xs px-2 sm:px-3 md:px-4 md:text-sm whitespace-nowrap">Reviews</TabsTrigger>
              <TabsTrigger value="agents" className="flex-shrink-0 text-xs px-2 sm:px-3 md:px-4 md:text-sm whitespace-nowrap">
                <Bot className="h-3.5 w-3.5 mr-1" />
                AI Agents
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="dashboard" className="space-y-6 mt-6">
            <MerchantDashboard />
            <RFMSegmentation />
          </TabsContent>

          <TabsContent value="customers" className="space-y-6 mt-6">
            <CustomerList />
          </TabsContent>

          <TabsContent value="programs" className="space-y-6 mt-6">
            <CreateLoyaltyProgram />
            
            <CreatedPrograms onSelectProgram={setSelectedProgram} />

            {/* Earn Points — main cashier flow */}
            <Card className="border-2 bg-gradient-to-br from-card to-muted/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5 text-primary" />
                  Earn Points (Cashier)
                </CardTitle>
                <CardDescription>
                  Scan customer's QR code, enter purchase amount — tokens are credited automatically
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!selectedProgram && (
                  <Alert className="mb-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Please select a loyalty program above first
                    </AlertDescription>
                  </Alert>
                )}
                
                {selectedProgram && (isPaused || !isMintingActive) && (
                  <Alert variant="destructive" className="mb-4">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      Program is inactive. Activate it before crediting points.
                    </AlertDescription>
                  </Alert>
                )}
                
                <Button 
                  onClick={() => setEarnDialogOpen(true)}
                  disabled={!selectedProgram || isPaused || !isMintingActive} 
                  className="w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90"
                >
                  {selectedProgram ? `Credit ${selectedProgram.symbol} for Purchase` : 'Credit Points'}
                </Button>
              </CardContent>
            </Card>
            
            {/* Manual Issue — for advanced use */}
            <Card className="border-2 bg-gradient-to-br from-card to-muted/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Coins className="h-5 w-5 text-primary" />
                  Issue Tokens (Manual)
                </CardTitle>
                <CardDescription>Distribute a custom amount of tokens directly</CardDescription>
              </CardHeader>
              <CardContent>
                {!selectedProgram && (
                  <Alert className="mb-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Please select a loyalty program above before issuing rewards
                    </AlertDescription>
                  </Alert>
                )}
                
                {selectedProgram && (isPaused || !isMintingActive) && (
                  <Alert variant="destructive" className="mb-4">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      This program is currently inactive. Please activate it using the play button in the Created Programs section before issuing tokens.
                    </AlertDescription>
                  </Alert>
                )}
                
                <Button 
                  onClick={() => setMintDialogOpen(true)}
                  disabled={!selectedProgram || isPaused || !isMintingActive} 
                  className="w-full"
                  variant="outline"
                >
                  {selectedProgram ? `Issue ${selectedProgram.symbol}` : 'Issue Tokens'}
                </Button>
              </CardContent>
            </Card>

            <EarnPointsDialog
              isOpen={earnDialogOpen}
              onClose={() => setEarnDialogOpen(false)}
              onSubmit={handleMintSubmit}
              isPending={isPending}
              cashbackRate={selectedProgram?.cashbackRate ?? 5}
              pointsPerDollar={selectedProgram?.pointsPerDollar ?? 1}
              programSymbol={selectedProgram?.symbol ?? 'tokens'}
            />

            <MintTokensDialog
              isOpen={mintDialogOpen}
              onClose={() => setMintDialogOpen(false)}
              onSubmit={handleMintSubmit}
              isPending={isPending}
            />
          </TabsContent>

          <TabsContent value="rewards" className="space-y-6 mt-6">
            <CreateReward />
            <RewardsList />
            <VouchersManagement />
          </TabsContent>

          <TabsContent value="tiers" className="space-y-6 mt-6">
            <TierManagement />
          </TabsContent>

          <TabsContent value="marketing" className="space-y-6 mt-6">
            <CreateCampaign />
            <CampaignList />
            <AutomationDashboard />
          </TabsContent>

          <TabsContent value="referrals" className="space-y-6 mt-6">
            <ReferralStats />
            <ReferralManagement />
          </TabsContent>

          <TabsContent value="reviews" className="space-y-6 mt-6">
            {selectedProgram ? (
              <ReviewsList
                tokenAddress={selectedProgram.tokenAddress}
                merchantAddress={address.toLowerCase()}
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
          </TabsContent>

          <TabsContent value="agents" className="space-y-6 mt-6">
            <AgentReportsDashboard />
            <AgentManagement />
            <AgentBillingDashboard />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
