import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowRightLeft, ArrowDownUp, Info } from 'lucide-react';
import { useSwapWithCashback } from '@/hooks/useSwapWithCashback';
import { Alert, AlertDescription } from '@/components/ui/alert';

const SUPPORTED_TOKENS = [
  { symbol: 'ETH', name: 'Ethereum', address: '0x0000000000000000000000000000000000000000' },
  { symbol: 'USDC', name: 'USD Coin', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' },
  { symbol: 'USDT', name: 'Tether', address: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2' },
];

export function DexIntegration() {
  const [fromToken, setFromToken] = useState(SUPPORTED_TOKENS[0].address);
  const [toToken, setToToken] = useState(SUPPORTED_TOKENS[1].address);
  const [amount, setAmount] = useState('');
  const { executeSwap, calculateFees, isProcessing } = useSwapWithCashback();

  const fees = amount ? calculateFees(amount) : null;

  const handleSwap = () => {
    if (!amount || parseFloat(amount) <= 0) {
      return;
    }
    executeSwap(fromToken, toToken, amount);
  };

  const handleFlipTokens = () => {
    setFromToken(toToken);
    setToToken(fromToken);
  };

  return (
    <Card className="border-2 bg-gradient-to-br from-card to-muted/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ArrowRightLeft className="h-5 w-5 text-primary" />
          DEX Aggregator with LOYAL Cashback
        </CardTitle>
        <CardDescription>
          Swap tokens and earn 0.1% cashback in LOYAL tokens
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert className="bg-primary/5 border-primary/20">
          <Info className="h-4 w-4 text-primary" />
          <AlertDescription className="text-sm">
            <strong>Routing Fee:</strong> 0.3% total fee (0.1% returned as LOYAL cashback, 0.2% platform fee)
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          {/* From Token */}
          <div className="space-y-2">
            <Label>From</Label>
            <div className="flex gap-2">
              <Select value={fromToken} onValueChange={setFromToken}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_TOKENS.map(token => (
                    <SelectItem key={token.address} value={token.address}>
                      {token.symbol}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="number"
                placeholder="0.0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="flex-1"
              />
            </div>
          </div>

          {/* Flip Button */}
          <div className="flex justify-center">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleFlipTokens}
              className="rounded-full"
            >
              <ArrowDownUp className="h-4 w-4" />
            </Button>
          </div>

          {/* To Token */}
          <div className="space-y-2">
            <Label>To</Label>
            <Select value={toToken} onValueChange={setToToken}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUPPORTED_TOKENS.filter(t => t.address !== fromToken).map(token => (
                  <SelectItem key={token.address} value={token.address}>
                    {token.symbol}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Fee Breakdown */}
          {fees && (
            <div className="p-4 rounded-lg bg-muted/50 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Routing Fee (0.3%)</span>
                <span className="font-medium">{fees.routingFee.toFixed(4)}</span>
              </div>
              <div className="flex justify-between text-primary">
                <span>LOYAL Cashback (0.1%)</span>
                <span className="font-semibold">+{fees.cashbackAmount.toFixed(4)} LOYAL</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Platform Fee (0.2%)</span>
                <span>{fees.platformFee.toFixed(4)}</span>
              </div>
              <div className="h-px bg-border my-2" />
              <div className="flex justify-between font-semibold">
                <span>You receive</span>
                <span>{fees.netAmount.toFixed(4)}</span>
              </div>
            </div>
          )}

          <Button
            onClick={handleSwap}
            disabled={!amount || parseFloat(amount) <= 0 || isProcessing}
            className="w-full"
          >
            {isProcessing ? 'Processing...' : 'Swap Tokens'}
          </Button>
        </div>

        {/* DEX Partners */}
        <div className="pt-4 border-t border-border">
          <p className="text-xs text-muted-foreground mb-3">Routing through:</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="p-3 rounded-lg bg-gradient-to-r from-primary/5 to-secondary/5 border border-primary/10">
              <p className="font-semibold text-sm">Uniswap</p>
              <p className="text-xs text-muted-foreground">Best rates</p>
            </div>
            <div className="p-3 rounded-lg bg-gradient-to-r from-primary/5 to-secondary/5 border border-primary/10">
              <p className="font-semibold text-sm">Aerodrome</p>
              <p className="text-xs text-muted-foreground">Base native</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
