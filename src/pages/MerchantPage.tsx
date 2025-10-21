import { WalletConnectButton } from '@/components/WalletConnectButton';
import { MerchantPanel } from '@/components/MerchantPanel';
import { IssuedTokensHistory } from '@/components/IssuedTokensHistory';
import { Sparkles, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import PageTransition from '@/components/PageTransition';

const MerchantPage = () => {

  return (
    <PageTransition>
      <div className="min-h-screen bg-white">
        <header className="sticky top-0 z-50 border-b border-border bg-white/80 backdrop-blur-xl">
          <div className="container mx-auto px-6 py-4 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <Link to="/">
                <Button variant="ghost" size="icon" className="hover:bg-secondary">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <img 
                src="/new-favicon.png" 
                alt="Loyal Spark" 
                className="h-9 w-9 rounded-lg" 
              />
              <div>
                <h1 className="text-xl font-bold text-foreground tracking-tight">
                  Loyal Spark
                </h1>
                <p className="text-xs text-muted-foreground">Merchant Portal</p>
              </div>
            </div>
            <WalletConnectButton />
          </div>
        </header>

        <main className="container mx-auto px-6 py-12 relative">
          <div className="grid grid-cols-1 lg:grid-cols-[350px_1fr] gap-6">
            <aside className="lg:sticky lg:top-24 lg:h-[calc(100vh-8rem)]">
              <IssuedTokensHistory />
            </aside>
            <div className="max-w-4xl">
              <MerchantPanel />
            </div>
          </div>
        </main>
      </div>
    </PageTransition>
  );
};

export default MerchantPage;
