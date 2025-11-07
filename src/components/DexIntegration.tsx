import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRightLeft, Lock } from 'lucide-react';

export function DexIntegration() {
  return (
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
        <CardTitle className="flex items-center gap-2">
          <ArrowRightLeft className="h-5 w-5 text-primary" />
          Exchange Loyalty Tokens
        </CardTitle>
        <CardDescription>
          Trade your loyalty tokens on decentralized exchanges
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between p-4 rounded-lg bg-gradient-to-r from-primary/5 to-secondary/5 border border-primary/10">
          <div>
            <p className="font-semibold">Uniswap</p>
            <p className="text-sm text-muted-foreground">Leading decentralized exchange</p>
          </div>
        </div>
        <div className="flex items-center justify-between p-4 rounded-lg bg-gradient-to-r from-primary/5 to-secondary/5 border border-primary/10">
          <div>
            <p className="font-semibold">Aerodrome</p>
            <p className="text-sm text-muted-foreground">Base network native DEX</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
