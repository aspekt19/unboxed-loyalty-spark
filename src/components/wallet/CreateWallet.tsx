import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  generateWallet, 
  importWallet, 
  encryptPrivateKey, 
  saveEncryptedWallet 
} from "@/lib/walletGenerator";
import { Wallet, Plus, Download, AlertTriangle, Eye, EyeOff, Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";

interface CreateWalletProps {
  onWalletCreated: (address: string) => void;
}

export default function CreateWallet({ onWalletCreated }: CreateWalletProps) {
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [generatedWallet, setGeneratedWallet] = useState<{ address: string; privateKey: string } | null>(null);
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleGenerateWallet = () => {
    if (!password || password.length < 8) {
      toast({
        title: "Weak Password",
        description: "Password must be at least 8 characters",
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Password Mismatch",
        description: "Passwords do not match",
        variant: "destructive",
      });
      return;
    }

    if (!agreedToTerms) {
      toast({
        title: "Terms Required",
        description: "Please agree to the security terms",
        variant: "destructive",
      });
      return;
    }

    const wallet = generateWallet();
    setGeneratedWallet(wallet);
  };

  const handleSaveWallet = () => {
    if (!generatedWallet) return;

    const encrypted = encryptPrivateKey(generatedWallet.privateKey, password);
    saveEncryptedWallet(generatedWallet.address, encrypted);

    toast({
      title: "Wallet Created",
      description: "Your wallet has been securely saved",
    });

    onWalletCreated(generatedWallet.address);
  };

  const handleImportWallet = () => {
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
      const encrypted = encryptPrivateKey(wallet.privateKey, password);
      saveEncryptedWallet(wallet.address, encrypted);

      toast({
        title: "Wallet Imported",
        description: "Your wallet has been imported successfully",
      });

      onWalletCreated(wallet.address);
    } catch (error) {
      toast({
        title: "Import Failed",
        description: error instanceof Error ? error.message : "Invalid private key",
        variant: "destructive",
      });
    }
  };

  const handleCopyPrivateKey = async () => {
    if (!generatedWallet) return;
    await navigator.clipboard.writeText(generatedWallet.privateKey);
    setCopied(true);
    toast({
      title: "Copied",
      description: "Private key copied to clipboard",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  if (generatedWallet) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5" />
            Save Your Wallet
          </CardTitle>
          <CardDescription>
            This is your only chance to save your private key!
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>IMPORTANT:</strong> Save your private key in a secure place. 
              If you lose it, you will lose access to your wallet forever!
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label>Your Wallet Address</Label>
            <div className="p-3 rounded-lg bg-muted font-mono text-sm break-all">
              {generatedWallet.address}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Your Private Key</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowPrivateKey(!showPrivateKey)}
              >
                {showPrivateKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </div>
            <div className="relative">
              <div className="p-3 rounded-lg bg-muted font-mono text-sm break-all">
                {showPrivateKey ? generatedWallet.privateKey : "•".repeat(66)}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-2"
                onClick={handleCopyPrivateKey}
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              onClick={() => setGeneratedWallet(null)}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveWallet}>
              <Download className="w-4 h-4 mr-2" />
              Save Wallet
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="w-5 h-5" />
          Create or Import Wallet
        </CardTitle>
        <CardDescription>
          Generate a new wallet or import an existing one
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="create" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="create">Create New</TabsTrigger>
            <TabsTrigger value="import">Import</TabsTrigger>
          </TabsList>

          <TabsContent value="create" className="space-y-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Your wallet will be stored encrypted in your browser. 
                Only you have access to it with your password.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="create-password">Password</Label>
              <Input
                id="create-password"
                type="password"
                placeholder="Min 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="terms"
                checked={agreedToTerms}
                onCheckedChange={(checked) => setAgreedToTerms(checked === true)}
              />
              <label
                htmlFor="terms"
                className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                I understand that I am responsible for keeping my wallet secure
              </label>
            </div>

            <Button 
              onClick={handleGenerateWallet} 
              className="w-full"
              disabled={!password || !confirmPassword || !agreedToTerms}
            >
              <Plus className="w-4 h-4 mr-2" />
              Generate New Wallet
            </Button>
          </TabsContent>

          <TabsContent value="import" className="space-y-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Never share your private key with anyone!
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="private-key">Private Key</Label>
              <Input
                id="private-key"
                type="password"
                placeholder="0x..."
                value={privateKey}
                onChange={(e) => setPrivateKey(e.target.value)}
                className="font-mono"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="import-password">Password</Label>
              <Input
                id="import-password"
                type="password"
                placeholder="Encrypt with password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <Button 
              onClick={handleImportWallet} 
              className="w-full"
              disabled={!password || !privateKey}
            >
              <Download className="w-4 h-4 mr-2" />
              Import Wallet
            </Button>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
