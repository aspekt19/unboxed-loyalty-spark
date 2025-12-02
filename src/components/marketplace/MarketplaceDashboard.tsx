import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CreateMarketplaceOffer } from './CreateMarketplaceOffer';
import { MarketplaceOffersList } from './MarketplaceOffersList';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Store, List, Users, Shield, Info } from 'lucide-react';

export function MarketplaceDashboard() {
  return (
    <div className="space-y-4">
      <Alert className="border-primary/50 bg-primary/5">
        <Users className="h-4 w-4 text-primary" />
        <AlertTitle className="flex items-center gap-2">
          Peer-to-Peer Token Exchange
        </AlertTitle>
        <AlertDescription className="space-y-2 text-sm">
          <p>Direct P2P marketplace where you exchange tokens directly with other users:</p>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            <li>No intermediaries - exchange happens directly between users</li>
            <li>You set your own exchange rates</li>
            <li>Tokens transfer immediately after accepting an offer</li>
            <li>Full control over your offers (create, cancel anytime)</li>
          </ul>
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="browse" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="browse" className="flex items-center gap-2">
            <Store className="h-4 w-4" />
            Browse P2P Offers
          </TabsTrigger>
          <TabsTrigger value="create" className="flex items-center gap-2">
            <List className="h-4 w-4" />
            Create P2P Offer
          </TabsTrigger>
        </TabsList>

        <TabsContent value="browse" className="space-y-4">
          <MarketplaceOffersList />
        </TabsContent>

        <TabsContent value="create">
          <CreateMarketplaceOffer />
        </TabsContent>
      </Tabs>
    </div>
  );
}
