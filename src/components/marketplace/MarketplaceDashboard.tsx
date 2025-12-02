import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CreateMarketplaceOffer } from './CreateMarketplaceOffer';
import { MarketplaceOffersList } from './MarketplaceOffersList';
import { Store, List } from 'lucide-react';

export function MarketplaceDashboard() {
  return (
    <Tabs defaultValue="browse" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="browse" className="flex items-center gap-2">
          <Store className="h-4 w-4" />
          Browse Offers
        </TabsTrigger>
        <TabsTrigger value="create" className="flex items-center gap-2">
          <List className="h-4 w-4" />
          Create Offer
        </TabsTrigger>
      </TabsList>

      <TabsContent value="browse" className="space-y-4">
        <MarketplaceOffersList />
      </TabsContent>

      <TabsContent value="create">
        <CreateMarketplaceOffer />
      </TabsContent>
    </Tabs>
  );
}
