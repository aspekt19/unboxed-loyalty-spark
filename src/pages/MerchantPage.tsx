import { WalletConnectButton } from '@/components/WalletConnectButton';
import { MerchantPanel } from '@/components/MerchantPanel';
import { Sparkles, ArrowLeft, Database } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import PageTransition from '@/components/PageTransition';
import { migrateAllData } from '@/lib/migrateLocalStorageData';
import { toast } from 'sonner';
import { useState } from 'react';

const MerchantPage = () => {
  const [isMigrating, setIsMigrating] = useState(false);

  const handleMigrateData = async () => {
    setIsMigrating(true);
    try {
      await migrateAllData();
      toast.success('Data migration completed!');
    } catch (error) {
      toast.error('Failed to migrate data');
      console.error('Migration error:', error);
    } finally {
      setIsMigrating(false);
    }
  };

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
              <div className="h-9 w-9 rounded-lg bg-black flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground tracking-tight">
                  Loyal Spark
                </h1>
                <p className="text-xs text-muted-foreground">Merchant Portal</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleMigrateData}
                disabled={isMigrating}
                className="gap-2"
              >
                <Database className="h-4 w-4" />
                {isMigrating ? 'Migrating...' : 'Migrate Data'}
              </Button>
              <WalletConnectButton />
            </div>
          </div>
        </header>

        <main className="container mx-auto px-6 py-12 relative">
          <div className="max-w-4xl mx-auto">
            <MerchantPanel />
          </div>
        </main>
      </div>
    </PageTransition>
  );
};

export default MerchantPage;
