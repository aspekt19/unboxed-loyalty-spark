import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Lock, Loader2 } from "lucide-react";

interface UnlockWalletProps {
  address: string;
  onUnlock: (password: string) => Promise<boolean>;
  isUnlocking: boolean;
  error: string | null;
}

export default function UnlockWallet({ address, onUnlock, isUnlocking, error }: UnlockWalletProps) {
  const [password, setPassword] = useState("");

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    
    const success = await onUnlock(password);
    if (success) {
      setPassword("");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="w-5 h-5" />
          Unlock Your Wallet
        </CardTitle>
        <CardDescription>
          Enter your password to access your wallet
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleUnlock} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label>Wallet Address</Label>
            <div className="p-3 rounded-lg bg-muted font-mono text-sm break-all">
              {address}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isUnlocking}
            />
          </div>

          <Button 
            type="submit"
            className="w-full"
            disabled={!password || isUnlocking}
          >
            {isUnlocking ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Unlocking...
              </>
            ) : (
              "Unlock Wallet"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
