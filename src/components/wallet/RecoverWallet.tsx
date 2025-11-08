import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  recoverFromMnemonic,
  importWallet, 
  encryptPrivateKey, 
  saveEncryptedWallet 
} from "@/lib/walletGenerator";
import { KeyRound, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface RecoverWalletProps {
  onWalletRecovered: (address: string) => void;
  onCancel: () => void;
}

export default function RecoverWallet({ onWalletRecovered, onCancel }: RecoverWalletProps) {
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [seedPhrase, setSeedPhrase] = useState("");
  const [privateKey, setPrivateKey] = useState("");

  const handleRecoverFromSeed = async () => {
    if (!password || password.length < 8) {
      toast({
        title: "Weak Password",
        description: "Password must be at least 8 characters",
        variant: "destructive",
      });
      return;
    }

    const words = seedPhrase.trim().split(/\s+/);
    if (words.length !== 12 && words.length !== 24) {
      toast({
        title: "Invalid Seed Phrase",
        description: "Seed phrase must be 12 or 24 words",
        variant: "destructive",
      });
      return;
    }

    try {
      const wallet = recoverFromMnemonic(seedPhrase);
      
      if (!wallet.privateKey) {
        throw new Error("Failed to derive private key from seed phrase");
      }

      const encryptedKey = encryptPrivateKey(wallet.privateKey, password);
      const encryptedMnemonic = encryptPrivateKey(wallet.mnemonic, password);
      
      saveEncryptedWallet(wallet.address, encryptedKey, encryptedMnemonic);

      toast({
        title: "Wallet Recovered",
        description: "Your wallet has been successfully recovered",
      });

      onWalletRecovered(wallet.address);
    } catch (error) {
      toast({
        title: "Recovery Failed",
        description: error instanceof Error ? error.message : "Invalid seed phrase",
        variant: "destructive",
      });
    }
  };

  const handleRecoverFromKey = async () => {
    if (!password || password.length < 8) {
      toast({
        title: "Weak Password",
        description: "Password must be at least 8 characters",
        variant: "destructive",
      });
      return;
    }

    if (!privateKey.startsWith("0x") || privateKey.length !== 66) {
      toast({
        title: "Invalid Private Key",
        description: "Private key must start with 0x and be 66 characters long",
        variant: "destructive",
      });
      return;
    }

    try {
      const wallet = importWallet(privateKey as `0x${string}`);
      const encryptedKey = encryptPrivateKey(wallet.privateKey, password);
      
      saveEncryptedWallet(wallet.address, encryptedKey);

      toast({
        title: "Wallet Recovered",
        description: "Your wallet has been successfully recovered",
      });

      onWalletRecovered(wallet.address);
    } catch (error) {
      toast({
        title: "Recovery Failed",
        description: error instanceof Error ? error.message : "Invalid private key",
        variant: "destructive",
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="w-5 h-5" />
          Recover Wallet
        </CardTitle>
        <CardDescription>
          Restore your wallet using seed phrase or private key
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Alert variant="destructive" className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>SECURITY WARNING:</strong> Never share your seed phrase or private key with anyone. 
            They will be encrypted and stored only in your browser.
          </AlertDescription>
        </Alert>

        <Tabs defaultValue="seed" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="seed">Seed Phrase</TabsTrigger>
            <TabsTrigger value="key">Private Key</TabsTrigger>
          </TabsList>

          <TabsContent value="seed" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="seed-phrase">Seed Phrase (12 or 24 words)</Label>
              <Textarea
                id="seed-phrase"
                placeholder="Enter your seed phrase separated by spaces"
                rows={4}
                value={seedPhrase}
                onChange={(e) => setSeedPhrase(e.target.value)}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                {seedPhrase.trim().split(/\s+/).filter(w => w).length} words entered
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="seed-password">Encryption Password</Label>
              <Input
                id="seed-password"
                type="password"
                placeholder="Min 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button 
                onClick={handleRecoverFromSeed}
                disabled={!seedPhrase || !password}
              >
                Recover Wallet
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="key" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="private-key-recover">Private Key</Label>
              <Input
                id="private-key-recover"
                type="password"
                placeholder="0x..."
                value={privateKey}
                onChange={(e) => setPrivateKey(e.target.value)}
                className="font-mono"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="key-password">Encryption Password</Label>
              <Input
                id="key-password"
                type="password"
                placeholder="Min 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button 
                onClick={handleRecoverFromKey}
                disabled={!privateKey || !password}
              >
                Recover Wallet
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
