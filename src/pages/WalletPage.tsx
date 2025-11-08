import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wallet, Send, Download, History, TrendingUp, Settings } from "lucide-react";
import { WalletConnectButton } from "@/components/WalletConnectButton";
import { useAccount } from "wagmi";
import TokenList from "@/components/wallet/TokenList";
import SendTokens from "@/components/wallet/SendTokens";
import ReceiveTokens from "@/components/wallet/ReceiveTokens";
import TransactionHistory from "@/components/wallet/TransactionHistory";
import { RoundUpDashboard } from "@/components/roundup/RoundUpDashboard";
import CreateWallet from "@/components/wallet/CreateWallet";
import RecoverWallet from "@/components/wallet/RecoverWallet";
import UnlockWallet from "@/components/wallet/UnlockWallet";
import NetworkSelector from "@/components/wallet/NetworkSelector";
import { getSavedWallets } from "@/lib/walletGenerator";
import { useLocalWallet } from "@/hooks/useLocalWallet";

export default function WalletPage() {
  const { isConnected } = useAccount();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [showCreateWallet, setShowCreateWallet] = useState(false);
  const [showRecoverWallet, setShowRecoverWallet] = useState(false);
  
  const {
    localWallet,
    hasLocalWallet,
    isUnlocked,
    unlockWallet,
    isUnlocking,
    error: unlockError,
  } = useLocalWallet();

  const handleWalletCreated = (address: string) => {
    // Перезагружаем страницу чтобы подхватить новый кошелек
    window.location.reload();
  };

  // Если нет кошелька (ни локального, ни подключенного)
  if (!isConnected && !hasLocalWallet) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-primary/5">
        <div className="max-w-md w-full space-y-4">
          <div className="text-center space-y-2 mb-6">
            <div className="flex justify-center">
              <div className="p-4 rounded-full bg-primary/10">
                <Wallet className="w-12 h-12 text-primary" />
              </div>
            </div>
            <h1 className="text-2xl font-bold">Web3 Wallet</h1>
            <p className="text-muted-foreground">
              Create a new wallet or connect an existing one
            </p>
          </div>
          
          {showCreateWallet ? (
            <CreateWallet onWalletCreated={handleWalletCreated} />
          ) : showRecoverWallet ? (
            <RecoverWallet 
              onWalletRecovered={handleWalletCreated}
              onCancel={() => setShowRecoverWallet(false)}
            />
          ) : (
            <Card className="p-8 text-center space-y-6">
              <div className="space-y-4">
                <Button 
                  onClick={() => setShowCreateWallet(true)}
                  className="w-full text-base"
                  size="lg"
                >
                  <Wallet className="w-4 h-4 mr-2" />
                  Create New Wallet
                </Button>
                <Button 
                  onClick={() => setShowRecoverWallet(true)}
                  variant="outline"
                  className="w-full text-base"
                  size="lg"
                >
                  Recover Existing Wallet
                </Button>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">Or</span>
                  </div>
                </div>
                <WalletConnectButton size="lg" />
              </div>
            </Card>
          )}
        </div>
      </div>
    );
  }

  // Если есть локальный кошелек, но он заблокирован
  if (!isConnected && hasLocalWallet && !isUnlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-primary/5">
        <div className="max-w-md w-full">
          <div className="text-center space-y-2 mb-6">
            <div className="flex justify-center">
              <div className="p-4 rounded-full bg-primary/10">
                <Wallet className="w-12 h-12 text-primary" />
              </div>
            </div>
            <h1 className="text-2xl font-bold">Web3 Wallet</h1>
            <p className="text-muted-foreground">
              Your wallet is locked
            </p>
          </div>
          
          <UnlockWallet
            address={localWallet?.address || ""}
            onUnlock={unlockWallet}
            isUnlocking={isUnlocking}
            error={unlockError}
          />
        </div>
      </div>
    );
  }

  // Определяем адрес кошелька (локальный или подключенный)
  const { address: connectedAddress } = useAccount();
  const walletAddress = isUnlocked && localWallet?.account 
    ? localWallet.account.address 
    : connectedAddress;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container mx-auto p-4 max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-primary/10">
              <Wallet className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">My Wallet</h1>
              {walletAddress && (
                <p className="text-sm text-muted-foreground font-mono">
                  {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                </p>
              )}
            </div>
          </div>
          {!isUnlocked && <WalletConnectButton />}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-6 mb-6">
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
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">Settings</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            <TokenList walletAddress={walletAddress} />
          </TabsContent>

          <TabsContent value="send">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center space-y-4 py-8">
                  <p className="text-muted-foreground">
                    To send transactions, please connect an external wallet like MetaMask
                  </p>
                  <WalletConnectButton size="lg" />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="receive">
            <ReceiveTokens walletAddress={walletAddress} />
          </TabsContent>

          <TabsContent value="history">
            <TransactionHistory />
          </TabsContent>

          <TabsContent value="roundup">
            {isConnected ? (
              <RoundUpDashboard />
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center space-y-4 py-8">
                    <p className="text-muted-foreground">
                      Round-Up feature requires an external wallet connection (MetaMask, etc.)
                    </p>
                    <WalletConnectButton size="lg" />
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <NetworkSelector />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
