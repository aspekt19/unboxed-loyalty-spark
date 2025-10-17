import { WalletConnectButton } from '@/components/WalletConnectButton';
import { MerchantPanel } from '@/components/MerchantPanel';
import { CustomerPanel } from '@/components/CustomerPanel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sparkles } from 'lucide-react';

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b-2 border-border/50 bg-gradient-to-r from-card to-background backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg">
              <Sparkles className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                Loyal Spark
              </h1>
              <p className="text-xs text-muted-foreground">BASE Network</p>
            </div>
          </div>
          <WalletConnectButton />
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-3 bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent">
              Decentralized Loyalty Rewards
            </h2>
            <p className="text-muted-foreground text-lg">
              Create, manage, and transfer loyalty tokens on the blockchain
            </p>
          </div>

          <Tabs defaultValue="customer" className="w-full">
            <TabsList className="grid w-full grid-cols-2 h-12 bg-muted/50 p-1">
              <TabsTrigger value="customer" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-secondary data-[state=active]:text-primary-foreground">
                Customer
              </TabsTrigger>
              <TabsTrigger value="merchant" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-secondary data-[state=active]:text-primary-foreground">
                Merchant
              </TabsTrigger>
            </TabsList>
            <TabsContent value="customer" className="mt-8">
              <CustomerPanel />
            </TabsContent>
            <TabsContent value="merchant" className="mt-8">
              <MerchantPanel />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default Index;
