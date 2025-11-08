import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAccount, useBalance } from "wagmi";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { formatEther } from "viem";
import { Button } from "@/components/ui/button";

const TOKENS = [
  {
    address: "0x0000000000000000000000000000000000000000" as const,
    symbol: "ETH",
    name: "Ethereum",
    decimals: 18,
    isNative: true,
  },
  // Можно добавить другие токены
];

export default function TokenList({ walletAddress }: { walletAddress?: `0x${string}` }) {
  const { data: ethBalance, isLoading } = useBalance({
    address: walletAddress,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Your Assets</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between p-4 rounded-lg border">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
              <Skeleton className="h-6 w-24" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  const totalBalanceUSD = ethBalance ? parseFloat(formatEther(ethBalance.value)) * 2000 : 0; // Примерная цена ETH

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-background">
        <CardContent className="pt-6">
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">Total Balance</p>
            <h2 className="text-4xl font-bold">
              ${totalBalanceUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h2>
            <div className="flex items-center justify-center gap-2 text-sm text-green-500">
              <ArrowUpRight className="w-4 h-4" />
              <span>+2.5% Today</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your Assets</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {TOKENS.map((token) => {
            const balance = token.isNative && ethBalance ? ethBalance : null;
            const balanceFormatted = balance ? parseFloat(formatEther(balance.value)).toFixed(4) : "0.0000";
            const balanceUSD = balance ? parseFloat(formatEther(balance.value)) * 2000 : 0;

            return (
              <div
                key={token.symbol}
                className="flex items-center justify-between p-4 rounded-lg border hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center font-bold text-primary">
                    {token.symbol[0]}
                  </div>
                  <div>
                    <p className="font-semibold">{token.symbol}</p>
                    <p className="text-sm text-muted-foreground">{token.name}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{balanceFormatted} {token.symbol}</p>
                  <p className="text-sm text-muted-foreground">
                    ${balanceUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
