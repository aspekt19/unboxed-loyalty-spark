import { supabase } from '@/integrations/supabase/client';
import { DashboardTab } from './merchant/tabs/DashboardTab';
import { CustomersTab } from './merchant/tabs/CustomersTab';
import { ProgramsTab } from './merchant/tabs/ProgramsTab';
import { RewardsTab } from './merchant/tabs/RewardsTab';
import { MarketingTab } from './merchant/tabs/MarketingTab';
import { AgentsTab } from './merchant/tabs/AgentsTab';
import { TeamTab } from './merchant/tabs/TeamTab';
import { CertificatesTab } from './merchant/tabs/CertificatesTab';
import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useMintTokens } from '@/hooks/useMintTokens';
import { useAccount } from 'wagmi';
import { toast } from 'sonner';
import { Wallet, Bot, Users, Building2, Briefcase, CreditCard, LayoutDashboard, UserSearch, Megaphone, Gift } from 'lucide-react';
import { MerchantBillingDashboard } from '@/components/merchant/MerchantBillingDashboard';
import { useCheckProgramStatus } from '@/hooks/useCheckProgramStatus';
import { mintTokensSchema } from '@/lib/validationSchemas';
import { useQuery } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

interface TeamMembership {
  merchant_address: string;
  role: string;
  branch_id: string | null;
  business_name: string;
  branch_name?: string;
}

interface MerchantPanelProps {
  /** When set, Tabs becomes controlled (mobile bottom-nav drives it). */
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  /** Hide the horizontal TabsList (bottom nav replaces it on mobile). */
  hideTabsList?: boolean;
}

export function MerchantPanel({ activeTab, onTabChange, hideTabsList }: MerchantPanelProps = {}) {
  const { address } = useAccount();
  const location = useLocation();
  const navigate = useNavigate();
  const VALID_TABS = ['dashboard', 'customers', 'programs', 'rewards', 'certificates', 'marketing', 'billing', 'agents', 'team'];
  const tabFromUrl = (() => {
    const t = new URLSearchParams(location.search).get('tab');
    return t && VALID_TABS.includes(t) ? t : null;
  })();
  const [internalTab, setInternalTab] = useState<string>(tabFromUrl ?? 'dashboard');

  // Sync internal tab with URL changes (e.g., when user clicks <Link to="/merchant?tab=billing">)
  useEffect(() => {
    if (tabFromUrl && tabFromUrl !== internalTab) {
      setInternalTab(tabFromUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabFromUrl]);

  const [selectedProgram, setSelectedProgram] = useState<{
    name: string;
    symbol: string;
    tokenAddress: string;
    cashbackRate?: number;
    pointsPerDollar?: number;
    tokenStandard?: 'erc20' | 'b20';
  } | null>(null);
  const [mintDialogOpen, setMintDialogOpen] = useState(false);
  const [earnDialogOpen, setEarnDialogOpen] = useState(false);
  const [lastMintParams, setLastMintParams] = useState<{ recipient: string; amount: string } | null>(null);
  // 'own' = own business, or merchant_address string = employee mode
  const [workspace, setWorkspace] = useState<string>('own');
  
  const { mintTokens, isPending, isSuccess, reset, hash } = useMintTokens();
  const { isPaused, isMintingActive } = useCheckProgramStatus(
    selectedProgram?.tokenAddress as `0x${string}` | undefined,
    selectedProgram?.tokenStandard ?? 'b20',
  );

  // Fetch team memberships
  const { data: memberships = [] } = useQuery<TeamMembership[]>({
    queryKey: ['my-team-memberships-panel', address],
    queryFn: async () => {
      if (!address) return [];
      const { data, error } = await supabase
        .from('merchant_employees')
        .select('*, merchant_branches(branch_name)')
        .eq('employee_wallet_address', address.toLowerCase())
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      if (error) throw error;

      type EmployeeRow = {
        merchant_address: string;
        role: string;
        branch_id: string | null;
        merchant_branches?: { branch_name?: string } | null;
      };
      const rows = (data ?? []) as EmployeeRow[];
      const merchantAddresses = [...new Set(rows.map((d) => d.merchant_address))];
      const { data: profiles } = await supabase
        .from('merchant_profiles')
        .select('merchant_address, business_name')
        .in('merchant_address', merchantAddresses);

      const profileMap = new Map(
        ((profiles ?? []) as Array<{ merchant_address: string; business_name: string }>).map(
          (p) => [p.merchant_address, p.business_name],
        ),
      );

      return rows.map((d) => ({
        merchant_address: d.merchant_address,
        role: d.role,
        branch_id: d.branch_id,
        business_name: profileMap.get(d.merchant_address) || `${d.merchant_address.slice(0, 6)}...${d.merchant_address.slice(-4)}`,
        branch_name: d.merchant_branches?.branch_name,
      }));
    },
    enabled: !!address,
  });

  const activeMembership = memberships.find(m => m.merchant_address === workspace);
  const isEmployeeMode = workspace !== 'own' && !!activeMembership;

  useEffect(() => {
    if (!address) {
      setSelectedProgram(null);
      setMintDialogOpen(false);
      setWorkspace('own');
    }
  }, [address]);

  // Reset selected program when switching workspace
  useEffect(() => {
    setSelectedProgram(null);
    setMintDialogOpen(false);
    setEarnDialogOpen(false);
  }, [workspace]);

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
      const merchantAddr = isEmployeeMode ? activeMembership!.merchant_address : address.toLowerCase();
      supabase
        .from('token_mint_history')
        .insert({
          merchant_address: merchantAddr,
          recipient_address: lastMintParams.recipient.toLowerCase(),
          amount: parseFloat(lastMintParams.amount),
          token_address: selectedProgram.tokenAddress.toLowerCase(),
          token_name: selectedProgram.name,
          token_symbol: selectedProgram.symbol,
          transaction_hash: hash || null,
          employee_address: isEmployeeMode ? address.toLowerCase() : null,
          branch_id: isEmployeeMode ? activeMembership!.branch_id : null,
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
  }, [isSuccess, reset, selectedProgram, address, lastMintParams, hash, isEmployeeMode, activeMembership]);

  if (!address) {
    return (
      <Alert>
        <Wallet className="h-4 w-4" />
        <AlertDescription>Please connect your wallet to access the merchant panel</AlertDescription>
      </Alert>
    );
  }

  const showWorkspaceSwitcher = memberships.length > 0;

  return (
    <div className="space-y-4">
      {showWorkspaceSwitcher && (
        <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground flex-shrink-0">
            <Briefcase className="h-4 w-4" />
            <span className="hidden sm:inline">Working as:</span>
          </div>
          <Select value={workspace} onValueChange={setWorkspace}>
            <SelectTrigger className="flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="own">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  <span>My Business</span>
                </div>
              </SelectItem>
              {memberships.map((m) => (
                <SelectItem key={m.merchant_address} value={m.merchant_address}>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    <span>{m.business_name}</span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {m.role === 'admin' ? 'Admin' : m.role === 'branch_manager' ? 'Manager' : 'Cashier'}
                    </Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {isEmployeeMode ? (
        /* Employee mode: tabs depend on role */
        <div className="space-y-4">
          {/* Team membership info + role guide */}
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4 text-primary" />
              <span>You are a team member at <strong className="text-foreground">{activeMembership!.business_name}</strong></span>
              {activeMembership!.branch_name && (
                <span className="text-muted-foreground">· {activeMembership!.branch_name}</span>
              )}
            </div>
            <Badge variant="outline" className="text-xs">
              {activeMembership!.role === 'admin' ? 'Administrator' : activeMembership!.role === 'branch_manager' ? 'Branch Manager' : 'Cashier'}
            </Badge>
            <div className="text-xs text-muted-foreground space-y-1 border-t pt-2">
              <p className="font-medium text-foreground/80">Your permissions:</p>
              {activeMembership!.role === 'cashier' && (
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>View loyalty programs of this store</li>
                  <li>Earn points for customers (scan wallet → enter purchase amount)</li>
                  <li>Rates and prices are set by the store owner and locked</li>
                </ul>
              )}
              {activeMembership!.role === 'branch_manager' && (
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>Everything a Cashier can do</li>
                  <li>Manually issue (mint) tokens to customers</li>
                  <li>View customer list and analytics</li>
                </ul>
              )}
              {activeMembership!.role === 'admin' && (
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>Everything a Manager can do</li>
                  <li>Access dashboard and analytics</li>
                  <li>Manage rewards catalog and marketing campaigns</li>
                </ul>
              )}
            </div>
          </div>

          {activeMembership!.role === 'cashier' ? (
            /* Cashier: only earn points */
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
              employeeMerchantAddress={activeMembership!.merchant_address}
              employeeRole={activeMembership!.role}
            />
          ) : (
            /* Manager / Admin: multiple tabs */
            <Tabs defaultValue="programs" className="w-full">
              <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0 pb-2">
                <TabsList className="inline-flex w-auto min-w-full">
                  <TabsTrigger value="programs" className="flex-shrink-0 text-xs px-2 sm:px-3 md:px-4 md:text-sm whitespace-nowrap">Programs</TabsTrigger>
                  <TabsTrigger value="customers" className="flex-shrink-0 text-xs px-2 sm:px-3 md:px-4 md:text-sm whitespace-nowrap">Customers</TabsTrigger>
                  {activeMembership!.role === 'admin' && (
                    <>
                      <TabsTrigger value="dashboard" className="flex-shrink-0 text-xs px-2 sm:px-3 md:px-4 md:text-sm whitespace-nowrap">Dashboard</TabsTrigger>
                      <TabsTrigger value="rewards" className="flex-shrink-0 text-xs px-2 sm:px-3 md:px-4 md:text-sm whitespace-nowrap">Rewards</TabsTrigger>
                      <TabsTrigger value="marketing" className="flex-shrink-0 text-xs px-2 sm:px-3 md:px-4 md:text-sm whitespace-nowrap">Marketing</TabsTrigger>
                    </>
                  )}
                </TabsList>
              </div>
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
                  employeeMerchantAddress={activeMembership!.merchant_address}
                  employeeRole={activeMembership!.role}
                />
              </TabsContent>
              <TabsContent value="customers" className="mt-6">
                <CustomersTab />
              </TabsContent>
              {activeMembership!.role === 'admin' && (
                <>
                  <TabsContent value="dashboard" className="mt-6">
                    <DashboardTab />
                  </TabsContent>
                  <TabsContent value="rewards" className="mt-6">
                    <RewardsTab />
                  </TabsContent>
                  <TabsContent value="marketing" className="mt-6">
                    <MarketingTab
                      selectedProgram={selectedProgram}
                      merchantAddress={activeMembership!.merchant_address}
                    />
                  </TabsContent>
                </>
              )}
            </Tabs>
          )}
        </div>
      ) : (
        /* Own business mode: full merchant panel */
        <Tabs
          value={activeTab !== undefined ? activeTab : internalTab}
          onValueChange={(v) => {
            if (activeTab !== undefined) {
              onTabChange?.(v);
            } else {
              setInternalTab(v);
              // Keep URL in sync so refresh / share links land on same tab
              const params = new URLSearchParams(location.search);
              params.set('tab', v);
              navigate(`${location.pathname}?${params.toString()}`, { replace: true });
            }
          }}
          className="w-full"
        >
          {hideTabsList ? (
            /* Mobile: show sub-tab bar only for "Home" group tabs */
            ['dashboard', 'customers', 'marketing', 'billing', 'agents'].includes(activeTab || 'dashboard') && (
              <div className="overflow-x-auto -mx-3 px-3 pb-2">
                <TabsList className="inline-flex w-auto min-w-full">
                  <TabsTrigger value="dashboard" className="flex-shrink-0 text-xs px-2 whitespace-nowrap">
                    <LayoutDashboard className="h-3.5 w-3.5 mr-1" />Dashboard
                  </TabsTrigger>
                  <TabsTrigger value="customers" className="flex-shrink-0 text-xs px-2 whitespace-nowrap">
                    <UserSearch className="h-3.5 w-3.5 mr-1" />Customers
                  </TabsTrigger>
                  <TabsTrigger value="marketing" className="flex-shrink-0 text-xs px-2 whitespace-nowrap">
                    <Megaphone className="h-3.5 w-3.5 mr-1" />Marketing
                  </TabsTrigger>
                  <TabsTrigger value="billing" className="flex-shrink-0 text-xs px-2 whitespace-nowrap">
                    <CreditCard className="h-3.5 w-3.5 mr-1" />Billing
                  </TabsTrigger>
                  <TabsTrigger value="agents" className="flex-shrink-0 text-xs px-2 whitespace-nowrap">
                    <Bot className="h-3.5 w-3.5 mr-1" />Agents
                  </TabsTrigger>
                </TabsList>
              </div>
            )
          ) : (
            <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0 pb-2">
              <TabsList className="inline-flex w-auto min-w-full">
                <TabsTrigger value="dashboard" className="flex-shrink-0 text-xs px-2 sm:px-3 md:px-4 md:text-sm whitespace-nowrap">Dashboard</TabsTrigger>
                <TabsTrigger value="customers" className="flex-shrink-0 text-xs px-2 sm:px-3 md:px-4 md:text-sm whitespace-nowrap">Customers</TabsTrigger>
                <TabsTrigger value="programs" className="flex-shrink-0 text-xs px-2 sm:px-3 md:px-4 md:text-sm whitespace-nowrap">Programs</TabsTrigger>
                <TabsTrigger value="rewards" className="flex-shrink-0 text-xs px-2 sm:px-3 md:px-4 md:text-sm whitespace-nowrap">Rewards</TabsTrigger>
                <TabsTrigger value="certificates" className="flex-shrink-0 text-xs px-2 sm:px-3 md:px-4 md:text-sm whitespace-nowrap">
                  <Gift className="h-3.5 w-3.5 mr-1" />Certificates
                </TabsTrigger>
                <TabsTrigger value="marketing" className="flex-shrink-0 text-xs px-2 sm:px-3 md:px-4 md:text-sm whitespace-nowrap">Marketing</TabsTrigger>
                <TabsTrigger value="billing" className="flex-shrink-0 text-xs px-2 sm:px-3 md:px-4 md:text-sm whitespace-nowrap">
                  <CreditCard className="h-3.5 w-3.5 mr-1" />Billing
                </TabsTrigger>
                <TabsTrigger value="agents" className="flex-shrink-0 text-xs px-2 sm:px-3 md:px-4 md:text-sm whitespace-nowrap">
                  <Bot className="h-3.5 w-3.5 mr-1" />AI Agents
                </TabsTrigger>
                <TabsTrigger value="team" className="flex-shrink-0 text-xs px-2 sm:px-3 md:px-4 md:text-sm whitespace-nowrap">
                  <Users className="h-3.5 w-3.5 mr-1" />Team
                </TabsTrigger>
              </TabsList>
            </div>
          )}

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
          <TabsContent value="certificates" className="mt-6">
            <CertificatesTab />
          </TabsContent>
          <TabsContent value="marketing" className="mt-6">
            <MarketingTab
              selectedProgram={selectedProgram}
              merchantAddress={address.toLowerCase()}
            />
          </TabsContent>
          <TabsContent value="billing" className="mt-6">
            <MerchantBillingDashboard />
          </TabsContent>
          <TabsContent value="agents" className="mt-6">
            <AgentsTab />
          </TabsContent>
          <TabsContent value="team" className="mt-6">
            <TeamTab />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
