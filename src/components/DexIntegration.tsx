import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExternalLink, ArrowRightLeft } from 'lucide-react';

interface DexIntegrationProps {
  tokenAddress?: string;
}

export function DexIntegration({ tokenAddress }: DexIntegrationProps) {
  const dexOptions = [
    {
      name: 'Uniswap',
      url: tokenAddress 
        ? `https://app.uniswap.org/#/swap?outputCurrency=${tokenAddress}&chain=base`
        : 'https://app.uniswap.org/#/swap?chain=base',
      description: 'Leading decentralized exchange',
    },
    {
      name: 'Aerodrome',
      url: tokenAddress
        ? `https://aerodrome.finance/swap?token=${tokenAddress}`
        : 'https://aerodrome.finance/swap',
      description: 'Base network native DEX',
    },
    {
      name: 'BaseSwap',
      url: tokenAddress
        ? `https://baseswap.fi/swap?outputCurrency=${tokenAddress}`
        : 'https://baseswap.fi/swap',
      description: 'Community-driven DEX on Base',
    },
  ];

  return (
    <Card className="border-2 bg-gradient-to-br from-card to-muted/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ArrowRightLeft className="h-5 w-5 text-primary" />
          Exchange Loyalty Tokens
        </CardTitle>
        <CardDescription>
          Trade your loyalty tokens on decentralized exchanges
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {dexOptions.map((dex) => (
          <div
            key={dex.name}
            className="flex items-center justify-between p-4 rounded-lg bg-gradient-to-r from-primary/5 to-secondary/5 border border-primary/10 hover:border-primary/30 transition-all"
          >
            <div>
              <p className="font-semibold">{dex.name}</p>
              <p className="text-sm text-muted-foreground">{dex.description}</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.open(dex.url, '_blank')}
              className="gap-2"
            >
              Trade
              <ExternalLink className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
