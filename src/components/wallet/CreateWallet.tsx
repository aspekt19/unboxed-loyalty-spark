import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  generateWalletWithMnemonic,
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
  const [generatedWallet, setGeneratedWallet] = useState<{ 
    address: string; 
    privateKey?: string; 
    mnemonic?: string;
  } | null>(null);
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [showSeedPhrase, setShowSeedPhrase] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedSeed, setCopiedSeed] = useState(false);

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

    try {
      // Генерируем кошелек с seed-фразой
      const wallet = generateWalletWithMnemonic();
      console.log("Generated wallet:", wallet);
      setGeneratedWallet(wallet);
    } catch (error) {
      console.error("Wallet generation error:", error);
      toast({
        title: "Generation Failed",
        description: error instanceof Error ? error.message : "Failed to generate wallet",
        variant: "destructive",
      });
    }
  };

  const handleSaveWallet = () => {
    if (!generatedWallet || !generatedWallet.privateKey) return;

    const encryptedKey = encryptPrivateKey(generatedWallet.privateKey, password);
    const encryptedMnemonic = generatedWallet.mnemonic 
      ? encryptPrivateKey(generatedWallet.mnemonic, password)
      : undefined;
    
    saveEncryptedWallet(generatedWallet.address, encryptedKey, encryptedMnemonic);

    toast({
      title: "Wallet Created",
      description: "Your wallet has been securely saved",
    });

    onWalletCreated(generatedWallet.address);
  };

  const handleCopyPrivateKey = async () => {
    if (!generatedWallet?.privateKey) return;
    await navigator.clipboard.writeText(generatedWallet.privateKey);
    setCopied(true);
    toast({
      title: "Copied",
      description: "Private key copied to clipboard",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopySeedPhrase = async () => {
    if (!generatedWallet?.mnemonic) return;
    await navigator.clipboard.writeText(generatedWallet.mnemonic);
    setCopiedSeed(true);
    toast({
      title: "Copied",
      description: "Seed phrase copied to clipboard",
    });
    setTimeout(() => setCopiedSeed(false), 2000);
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
            Write down your seed phrase - this is your only chance!
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>IMPORTANT:</strong> Save your seed phrase in a secure place. 
              If you lose it, you will lose access to your wallet forever!
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label>Your Wallet Address</Label>
            <div className="p-3 rounded-lg bg-muted font-mono text-sm break-all">
              {generatedWallet.address}
            </div>
          </div>

          {generatedWallet.mnemonic && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Your Seed Phrase (12 words)</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSeedPhrase(!showSeedPhrase)}
                >
                  {showSeedPhrase ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
              <div className="relative">
                <div className="p-3 pr-12 rounded-lg bg-muted font-mono text-sm break-all">
                  {showSeedPhrase ? generatedWallet.mnemonic : "• ".repeat(12) + "(Click eye to reveal)"}
                </div>
                {showSeedPhrase && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1"
                    onClick={handleCopySeedPhrase}
                  >
                    {copiedSeed ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                ✍️ Write down these 12 words in order and keep them safe. You can use them to recover your wallet.
              </p>
            </div>
          )}

          {generatedWallet.privateKey && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Your Private Key (alternative backup)</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPrivateKey(!showPrivateKey)}
                >
                  {showPrivateKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
              <div className="relative">
                <div className="p-3 pr-12 rounded-lg bg-muted font-mono text-sm break-all">
                  {showPrivateKey ? generatedWallet.privateKey : "•".repeat(66)}
                </div>
                {showPrivateKey && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1"
                    onClick={handleCopyPrivateKey}
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              onClick={() => setGeneratedWallet(null)}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveWallet}>
              <Download className="w-4 h-4 mr-2" />
              I Saved It, Continue
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
          Create New Wallet
        </CardTitle>
        <CardDescription>
          Generate a new secure wallet with seed phrase
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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
      </CardContent>
    </Card>
  );
}
