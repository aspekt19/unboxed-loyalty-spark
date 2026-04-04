import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRightLeft, Lock, ExternalLink, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const DEX_LIST = [
  {
    name: 'Uniswap',
    description: 'Leading decentralized exchange',
    url: 'https://app.uniswap.org/swap',
  },
  {
    name: 'Aerodrome',
    description: 'Base network native DEX',
    url: 'https://aerodrome.finance/swap',
  },
];

export function DexIntegration() {
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);

  const handleDexClick = (url: string) => {
    setPendingUrl(url);
  };

  const confirmNavigate = () => {
    if (pendingUrl) {
      window.open(pendingUrl, '_blank', 'noopener,noreferrer');
      setPendingUrl(null);
    }
  };

  return (
    <>
      <Card className="border-2 bg-gradient-to-br from-card to-muted/30 relative overflow-hidden">
        <div className="absolute inset-0 bg-muted/50 backdrop-blur-sm z-10 flex items-center justify-center">
          <div className="text-center space-y-2 p-6">
            <Lock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground">Coming Soon</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              This feature will be available with the launch of the Loyal Spark token
            </p>
          </div>
        </div>
        
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5 text-primary" />
              Exchange Loyalty Tokens
            </CardTitle>
            <Badge variant="outline" className="text-xs border-primary/30 text-primary">
              Base L2
            </Badge>
          </div>
          <CardDescription>
            Swap your earned loyalty tokens for other tokens or stablecoins on decentralized exchanges. All tokens live on Base L2.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {DEX_LIST.map((dex) => (
            <button
              key={dex.name}
              onClick={() => handleDexClick(dex.url)}
              className="w-full flex items-center justify-between p-4 rounded-lg bg-gradient-to-r from-primary/5 to-secondary/5 border border-primary/10 hover:border-primary/30 transition-colors text-left"
            >
              <div>
                <p className="font-semibold">{dex.name}</p>
                <p className="text-sm text-muted-foreground">{dex.description}</p>
              </div>
              <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            </button>
          ))}
        </CardContent>
      </Card>

      <AlertDialog open={!!pendingUrl} onOpenChange={() => setPendingUrl(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Leaving Loyal Spark
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 text-left">
              <p>You are about to visit an external decentralized exchange. Please note:</p>
              <ul className="list-disc pl-4 space-y-1 text-sm">
                <li>You will need ETH on Base for gas fees</li>
                <li>Token swaps are final and cannot be reversed</li>
                <li>Always verify the token contract address before swapping</li>
                <li>Loyal Spark is not responsible for trades on third-party platforms</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmNavigate}>
              Continue to DEX
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
