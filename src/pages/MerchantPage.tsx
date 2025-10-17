import { WalletConnectButton } from '@/components/WalletConnectButton';
import { MerchantPanel } from '@/components/MerchantPanel';
import { Sparkles, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const MerchantPage = () => {
  return (
    <div className="min-h-screen relative">
      {/* Background orbs */}
      <div className="absolute top-20 right-10 w-72 h-72 bg-secondary/20 rounded-full blur-3xl floating" />
      <div className="absolute bottom-20 left-10 w-96 h-96 bg-accent/20 rounded-full blur-3xl floating" style={{ animationDelay: '1s' }} />

      <header className="glass-effect sticky top-0 z-50 border-b border-primary/30">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Link to="/">
              <Button variant="ghost" size="icon" className="hover:bg-primary/20">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="relative h-12 w-12 rounded-2xl bg-gradient-to-br from-primary via-accent to-secondary flex items-center justify-center pulse-glow">
              <Sparkles className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gradient">
                Loyal Spark ✨
              </h1>
              <p className="text-xs text-muted-foreground">Merchant Portal</p>
            </div>
          </div>
          <WalletConnectButton />
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 relative z-10">
        <div className="max-w-4xl mx-auto">
          <MerchantPanel />
        </div>
      </main>
    </div>
  );
};

export default MerchantPage;
