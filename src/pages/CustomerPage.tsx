import { WalletConnectButton } from '@/components/WalletConnectButton';
import { CustomerPanel } from '@/components/CustomerPanel';
import { CustomerFiltersPanel } from '@/components/CustomerFiltersPanel';
import { WelcomeFlow } from '@/components/onboarding/WelcomeFlow';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Gift, ArrowLeft, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PageTransition from '@/components/PageTransition';
import { useEffect } from 'react';
import { initializeCleanState } from '@/lib/clearOldData';
import { RoundUpDashboard } from '@/components/roundup/RoundUpDashboard';

const CustomerPage = () => {
  // Clear old test data on first load
  useEffect(() => {
    initializeCleanState();
  }, []);

  return (
    <PageTransition>
      <WelcomeFlow userRole="customer" />
      <div className="min-h-screen bg-white">
        <header className="sticky top-0 z-50 border-b border-border bg-white/80 backdrop-blur-xl">
          <div className="container mx-auto px-2 sm:px-3 py-2 flex justify-between items-center gap-1.5 sm:gap-2">
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-shrink">
              <Link to="/">
                <Button variant="ghost" size="icon" className="hover:bg-secondary h-7 w-7 sm:h-8 sm:w-8">
                  <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </Button>
              </Link>
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
              <WalletConnectButton />
            </div>
          </div>
        </header>

        <main className="container mx-auto px-3 sm:px-4 md:px-6 py-6 sm:py-8 md:py-12 relative">
          <Tabs defaultValue="loyalty" className="space-y-6">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="loyalty" className="gap-2">
                <Gift className="h-4 w-4" />
                Loyalty Rewards
              </TabsTrigger>
              <TabsTrigger value="roundup" className="gap-2">
                <TrendingUp className="h-4 w-4" />
                Round-Up Invest
              </TabsTrigger>
            </TabsList>

            <TabsContent value="loyalty">
              <div className="grid grid-cols-1 lg:grid-cols-[350px_1fr] gap-6">
                <aside className="lg:sticky lg:top-24 lg:h-[calc(100vh-8rem)]">
                  <CustomerFiltersPanel />
                </aside>
                <div className="max-w-4xl">
                  <CustomerPanel />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="roundup">
              <RoundUpDashboard />
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </PageTransition>
  );
};

export default CustomerPage;
