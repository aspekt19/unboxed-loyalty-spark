import { WalletConnectButton } from '@/components/WalletConnectButton';
import { CustomerPanel } from '@/components/CustomerPanel';
import { Sparkles, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const CustomerPage = () => {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b-2 border-primary/20 bg-card shadow-soft sticky top-0 z-50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Link to="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-glow">
              <Sparkles className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                Loyal Spark
              </h1>
              <p className="text-xs text-muted-foreground">Customer Portal</p>
            </div>
          </div>
          <WalletConnectButton />
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <CustomerPanel />
        </div>
      </main>
    </div>
  );
};

export default CustomerPage;
