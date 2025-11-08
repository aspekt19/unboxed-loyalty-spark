import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Wallet, Send, Download, History, TrendingUp } from "lucide-react";
import { WalletConnectButton } from "@/components/WalletConnectButton";
import { useAccount } from "wagmi";
import TokenList from "@/components/wallet/TokenList";
import SendTokens from "@/components/wallet/SendTokens";
import ReceiveTokens from "@/components/wallet/ReceiveTokens";
import TransactionHistory from "@/components/wallet/TransactionHistory";
import { RoundUpDashboard } from "@/components/roundup/RoundUpDashboard";

export default function WalletPage() {
  const { isConnected } = useAccount();
  const [activeTab, setActiveTab] = useState("dashboard");

  if (!isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-primary/5">
        <Card className="p-8 max-w-md w-full text-center space-y-6">
          <div className="flex justify-center">
            <div className="p-4 rounded-full bg-primary/10">
              <Wallet className="w-12 h-12 text-primary" />
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">Web3 Wallet</h1>
            <p className="text-muted-foreground">
              Connect your wallet to access all features
            </p>
          </div>
          <WalletConnectButton />
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container mx-auto p-4 max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-primary/10">
              <Wallet className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-2xl font-bold">My Wallet</h1>
          </div>
          <WalletConnectButton />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5 mb-6">
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <Wallet className="w-4 h-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </TabsTrigger>
            <TabsTrigger value="send" className="flex items-center gap-2">
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline">Send</span>
            </TabsTrigger>
            <TabsTrigger value="receive" className="flex items-center gap-2">
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Receive</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="w-4 h-4" />
              <span className="hidden sm:inline">History</span>
            </TabsTrigger>
            <TabsTrigger value="roundup" className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              <span className="hidden sm:inline">Round-Up</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            <TokenList />
          </TabsContent>

          <TabsContent value="send">
            <SendTokens />
          </TabsContent>

          <TabsContent value="receive">
            <ReceiveTokens />
          </TabsContent>

          <TabsContent value="history">
            <TransactionHistory />
          </TabsContent>

          <TabsContent value="roundup">
            <RoundUpDashboard />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
