import { WalletConnectButton } from '@/components/WalletConnectButton';
import { MerchantPanel } from '@/components/MerchantPanel';
import { IssuedTokensHistory } from '@/components/IssuedTokensHistory';
import { WelcomeFlow } from '@/components/onboarding/WelcomeFlow';
import { ThemeToggle } from '@/components/ThemeToggle';
import { PremiumStatusBadge } from '@/components/PremiumStatusBadge';
import { MerchantProfileSection } from '@/components/merchant/MerchantProfileSection';
import { AcceptMerchantInviteCard } from '@/components/team/AcceptMerchantInviteCard';
import { ArrowLeft } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import PageTransition from '@/components/PageTransition';
import { PullToRefresh } from '@/components/mobile/PullToRefresh';
import { useIsMobile } from '@/hooks/use-mobile';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

const MerchantPage = () => {
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const location = useLocation();
  const isNativeMode = location.pathname.startsWith('/native/');
  const [showProfile, setShowProfile] = useState(false);

  const handleRefresh = useCallback(async () => {
    await queryClient.invalidateQueries();
    await new Promise(resolve => setTimeout(resolve, 500));
  }, [queryClient]);

  const content = showProfile ? (
    <div className="max-w-2xl mx-auto">
      <MerchantProfileSection onUpgrade={() => setShowProfile(false)} />
    </div>
  ) : (
    <>
      <div className="mb-6 space-y-4">
        <PremiumStatusBadge />
        <AcceptMerchantInviteCard />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[350px_1fr] gap-6">
        <aside className="hidden lg:block lg:sticky lg:top-24 lg:h-[calc(100vh-8rem)]">
          <IssuedTokensHistory />
        </aside>
        <div className="max-w-4xl">
          <MerchantPanel />
        </div>
      </div>
    </>
  );

  return (
    <PageTransition>
      <WelcomeFlow userRole="merchant" />
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
                <p className="text-[9px] sm:text-[10px] text-muted-foreground truncate">Merchant Portal</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                variant={showProfile ? 'default' : 'outline'}
                size="sm"
                onClick={() => setShowProfile(!showProfile)}
                className="h-8 sm:h-9 text-xs sm:text-sm px-2 sm:px-3"
              >
                Profile
              </Button>
              <ThemeToggle />
              <WalletConnectButton />
            </div>
          </div>
        </header>

        <main className="container mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-8 md:py-12 relative">
          {isMobile ? (
            <PullToRefresh onRefresh={handleRefresh}>
              {content}
            </PullToRefresh>
          ) : (
            content
          )}
        </main>
      </div>
    </PageTransition>
  );
};

export default MerchantPage;
