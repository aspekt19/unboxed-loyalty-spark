import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CreateMarketplaceOffer } from './CreateMarketplaceOffer';
import { MarketplaceOffersList } from './MarketplaceOffersList';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Store, List, Users, HelpCircle } from 'lucide-react';

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

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <HelpCircle className="h-5 w-5 text-primary" />
            FAQ: P2P Token Exchange
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="security">
              <AccordionTrigger>Is P2P exchange safe?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground space-y-2">
                <p>Yes, P2P exchange is safe because:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>All transfers happen directly between wallets on the blockchain</li>
                  <li>Each transaction is recorded on the blockchain and can be verified</li>
                  <li>You always see exactly what tokens you're exchanging before confirming</li>
                  <li>No third party holds your tokens during the exchange</li>
                </ul>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="cancel">
              <AccordionTrigger>How do I cancel my offer?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground space-y-2">
                <p>To cancel your offer:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Go to "Browse P2P Offers" tab</li>
                  <li>Find your active offer (marked with your wallet address)</li>
                  <li>Click the "Cancel" button next to your offer</li>
                  <li>The offer will be immediately removed from the marketplace</li>
                </ul>
                <p className="mt-2">Note: You can only cancel offers that haven't been accepted yet.</p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="problem">
              <AccordionTrigger>What if I encounter a problem?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground space-y-2">
                <p>If you encounter any issues:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Check that you have enough tokens in your wallet for the exchange</li>
                  <li>Make sure your wallet is connected and on the correct network</li>
                  <li>Verify the transaction in your wallet's history</li>
                  <li>If a transaction fails, your tokens remain in your wallet</li>
                </ul>
                <p className="mt-2">All blockchain transactions are final once confirmed. Make sure to double-check the exchange details before accepting.</p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="fees">
              <AccordionTrigger>Are there any fees?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                <p>The platform does not charge any fees for P2P exchanges. However, you will need to pay standard blockchain gas fees for token transfers. Gas fees are paid in the native currency of the network (e.g., ETH on Ethereum).</p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="rates">
              <AccordionTrigger>Who sets the exchange rates?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                <p>Exchange rates are set by the users themselves. When you create an offer, you decide how many tokens you want to offer and how many you want to receive in return. Other users can then accept your offer if they agree with the rate.</p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}
