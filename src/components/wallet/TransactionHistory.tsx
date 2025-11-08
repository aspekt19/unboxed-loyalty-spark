import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAccount, useBlockNumber } from "wagmi";
import { History, ArrowUpRight, ArrowDownLeft, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

// Пример данных транзакций (в реальном приложении это будет из API или событий блокчейна)
const MOCK_TRANSACTIONS = [
  {
    hash: "0x1234...5678",
    type: "send" as const,
    amount: "0.5",
    token: "ETH",
    to: "0xabcd...efgh",
    timestamp: Date.now() - 3600000,
    status: "confirmed" as const,
  },
  {
    hash: "0x8765...4321",
    type: "receive" as const,
    amount: "1.2",
    token: "ETH",
    from: "0xijkl...mnop",
    timestamp: Date.now() - 7200000,
    status: "confirmed" as const,
  },
  {
    hash: "0x9999...1111",
    type: "send" as const,
    amount: "0.1",
    token: "ETH",
    to: "0xqrst...uvwx",
    timestamp: Date.now() - 86400000,
    status: "confirmed" as const,
  },
];

export default function TransactionHistory() {
  const { address } = useAccount();
  const { data: blockNumber, isLoading } = useBlockNumber();

  const formatTime = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    return "Just now";
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            Transaction History
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between p-4 rounded-lg border">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <Skeleton className="h-6 w-20" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="w-5 h-5" />
          Transaction History
        </CardTitle>
        <CardDescription>
          Your recent blockchain transactions
        </CardDescription>
      </CardHeader>
      <CardContent>
        {MOCK_TRANSACTIONS.length === 0 ? (
          <div className="text-center py-12 space-y-3">
            <div className="flex justify-center">
              <div className="p-4 rounded-full bg-muted">
                <History className="w-8 h-8 text-muted-foreground" />
              </div>
            </div>
            <p className="text-muted-foreground">No transactions yet</p>
            <p className="text-sm text-muted-foreground">
              Your transaction history will appear here
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {MOCK_TRANSACTIONS.map((tx) => (
              <div
                key={tx.hash}
                className="flex items-center justify-between p-4 rounded-lg border hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`h-10 w-10 rounded-full flex items-center justify-center ${
                      tx.type === "send"
                        ? "bg-red-500/10 text-red-500"
                        : "bg-green-500/10 text-green-500"
                    }`}
                  >
                    {tx.type === "send" ? (
                      <ArrowUpRight className="w-5 h-5" />
                    ) : (
                      <ArrowDownLeft className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">
                        {tx.type === "send" ? "Sent" : "Received"} {tx.token}
                      </p>
                      <Badge variant="secondary" className="text-xs">
                        {tx.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {tx.type === "send" ? "To" : "From"}: {tx.type === "send" ? tx.to : tx.from}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatTime(tx.timestamp)}
                    </p>
                  </div>
                </div>
                <div className="text-right flex items-center gap-3">
                  <div>
                    <p className={`font-semibold ${tx.type === "send" ? "text-red-500" : "text-green-500"}`}>
                      {tx.type === "send" ? "-" : "+"}{tx.amount} {tx.token}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      ${(parseFloat(tx.amount) * 2000).toFixed(2)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => window.open(`https://basescan.org/tx/${tx.hash}`, "_blank")}
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
