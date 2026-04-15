import { WalletConnectButton } from '@/components/WalletConnectButton';
import { CustomerPanel } from '@/components/CustomerPanel';
import { CustomerFiltersPanel } from '@/components/CustomerFiltersPanel';
import { WelcomeFlow } from '@/components/onboarding/WelcomeFlow';
import { ThemeToggle } from '@/components/ThemeToggle';
import { PremiumStatusBadge } from '@/components/PremiumStatusBadge';
import { PremiumExpirationAlert } from '@/components/PremiumExpirationAlert';
import { Gift, ArrowLeft, Store } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PageTransition from '@/components/PageTransition';
import { useEffect, useState, useCallback } from 'react';
import { initializeCleanState } from '@/lib/clearOldData';
import { PremiumUpgradeDialog } from '@/components/roundup/PremiumUpgradeDialog';
import { MarketplaceDashboard } from '@/components/marketplace/MarketplaceDashboard';
import { BottomNavBar } from '@/components/mobile/BottomNavBar';
import { CustomerProfileSection } from '@/components/customer/CustomerProfileSection';
import { PullToRefresh } from '@/components/mobile/PullToRefresh';
import { useIsMobile } from '@/hooks/use-mobile';
import { useQueryClient } from '@tanstack/react-query';

const CustomerPage = () => {
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const [activeTab, setActiveTab] = useState('loyalty');
  const [selectedMerchant, setSelectedMerchant] = useState<string | null>(null);
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const location = useLocation();
  const isNativeMode = location.pathname.startsWith('/native/');

  useEffect(() => {
    initializeCleanState();
  }, []);

  const handleRefresh = useCallback(async () => {
    await queryClient.invalidateQueries();
    // Small delay so user sees the refresh indicator
    await new Promise(resolve => setTimeout(resolve, 500));
  }, [queryClient]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
  };

  const handleMerchantSelect = (merchantAddress: string) => {
    setSelectedMerchant(prev => prev === merchantAddress ? null : merchantAddress);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'loyalty':
        return (
          <div className="grid grid-cols-1 lg:grid-cols-[350px_1fr] gap-6">
            <aside className="hidden lg:block lg:sticky lg:top-24 lg:h-[calc(100vh-8rem)]">
              <CustomerFiltersPanel filterByMerchant={selectedMerchant} />
            </aside>
            <div className="max-w-4xl">
              <CustomerPanel
                selectedMerchant={selectedMerchant}
                onMerchantSelect={handleMerchantSelect}
                onClearMerchantFilter={() => setSelectedMerchant(null)}
              />
            </div>
          </div>
        );
      case 'marketplace':
        return (
          <div className="max-w-4xl mx-auto">
            <MarketplaceDashboard />
          </div>
        );
      case 'profile':
        return <CustomerProfileSection onUpgrade={() => setShowUpgradeDialog(true)} />;
      default:
        return null;
    }
  };

  return (
    <PageTransition>
      <WelcomeFlow userRole="customer" />
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
          <div className="container mx-auto px-2 sm:px-3 py-2 flex justify-between items-center gap-1.5 sm:gap-2">
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-shrink">
              {!isNativeMode && (
                <Link to="/">
                  <Button variant="ghost" size="icon" className="hover:bg-secondary h-7 w-7 sm:h-8 sm:w-8">
                    <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </Button>
                </Link>
              )}
              <img 
                src="/new-favicon.png" 
                alt="Loyal Spark" 
                className="h-6 w-6 sm:h-7 sm:w-7 rounded-lg flex-shrink-0" 
              />
              <div className="min-w-0">
                <h1 className="text-xs sm:text-sm font-bold text-foreground tracking-tight truncate">
                  Loyal Spark
                </h1>
                <p className="text-[9px] sm:text-[10px] text-muted-foreground truncate">Customer Portal</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <ThemeToggle />
              {!isMobile && (
                <button
                  onClick={() => handleTabChange('profile')}
                  type="button"
                  className={`px-4 py-2 rounded-xl font-bold shadow-md hover:shadow-lg transition-all duration-200 flex items-center gap-1.5 ${
                    activeTab === 'profile'
                      ? 'bg-uds-purple text-white hover:bg-uds-purple-light'
                      : 'border-2 border-input bg-background hover:bg-accent hover:text-accent-foreground hover:border-primary/50'
                  }`}
                >
                  Profile
                </button>
              )}
              <WalletConnectButton />
            </div>
          </div>
        </header>

        <main className="container mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-8 md:py-12 relative">
          {/* Desktop: show premium badges inline */}

          {/* Desktop: tabs at the top */}
          {!isMobile ? (
            <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
              <TabsList className="grid w-full max-w-md grid-cols-2">
                <TabsTrigger value="loyalty" className="gap-2">
                  <Gift className="h-4 w-4" />
                  Loyalty
                </TabsTrigger>
                <TabsTrigger value="marketplace" className="gap-2">
                  <Store className="h-4 w-4" />
                  Exchange
                </TabsTrigger>
              </TabsList>

              <TabsContent value="loyalty">
                <div className="grid grid-cols-1 lg:grid-cols-[350px_1fr] gap-6">
                  <aside className="lg:sticky lg:top-24 lg:h-[calc(100vh-8rem)]">
                    <CustomerFiltersPanel filterByMerchant={selectedMerchant} />
                  </aside>
                  <div className="max-w-4xl">
                    <CustomerPanel
                      selectedMerchant={selectedMerchant}
                      onMerchantSelect={handleMerchantSelect}
                      onClearMerchantFilter={() => setSelectedMerchant(null)}
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="marketplace">
                <div className="max-w-4xl mx-auto">
                  <MarketplaceDashboard />
                </div>
              </TabsContent>

              <TabsContent value="profile">
                <div className="max-w-2xl mx-auto">
                  <CustomerProfileSection onUpgrade={() => setShowUpgradeDialog(true)} />
                </div>
              </TabsContent>

            </Tabs>
          ) : (
            /* Mobile: content driven by bottom nav */
            <PullToRefresh onRefresh={handleRefresh}>
              <div className="pb-24">
                {renderContent()}
              </div>
            </PullToRefresh>
          )}
        </main>

        {/* Bottom Navigation for mobile */}
        {isMobile && (
          <BottomNavBar activeTab={activeTab} onTabChange={handleTabChange} />
        )}

        <PremiumUpgradeDialog 
          open={showUpgradeDialog}
          onOpenChange={setShowUpgradeDialog}
        />
      </div>
    </PageTransition>
  );
};

export default CustomerPage;
