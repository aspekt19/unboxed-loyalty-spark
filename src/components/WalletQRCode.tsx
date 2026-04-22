import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { QRCodeSVG } from 'qrcode.react';
import { useAccount } from 'wagmi';
import { QrCode, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useActiveWallet } from '@/contexts/ActiveWalletContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export function WalletQRCode() {
  const { address } = useAccount();
  const { activeWallet } = useActiveWallet();
  const [copied, setCopied] = useState(false);
  const walletAddress = activeWallet ?? address;

  if (!walletAddress) return null;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(walletAddress);
    setCopied(true);
    toast.success('Wallet address copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const shortAddress = `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;

  return (
    <Card className="border-2 border-dashed border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <QrCode className="h-5 w-5 text-primary" />
          Your QR Code
        </CardTitle>
        <CardDescription className="text-xs">
          Show this at checkout. Merchant scans, you earn loyalty tokens.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-3">
        <Dialog>
          <DialogTrigger asChild>
            <button className="bg-background p-3 rounded-xl shadow-sm border cursor-pointer hover:shadow-md transition-shadow">
              <QRCodeSVG
                value={walletAddress}
                size={120}
                level="M"
                includeMargin={false}
              />
            </button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <QrCode className="h-5 w-5" />
                Your Wallet QR Code
              </DialogTitle>
              <DialogDescription>
                Show this QR code to any participating merchant to receive loyalty tokens
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="bg-background p-4 rounded-xl border">
                <QRCodeSVG
                  value={walletAddress}
                  size={240}
                  level="H"
                  includeMargin
                />
              </div>
              <p className="text-xs text-muted-foreground font-mono text-center break-all px-4">
                {walletAddress}
              </p>
              <Button variant="outline" size="sm" onClick={handleCopy} className="gap-2">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copied!' : 'Copy Address'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Visible wallet address */}
        <div className="w-full bg-background/80 rounded-lg border px-3 py-2 flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-muted-foreground mb-0.5">Your wallet address</p>
            <p className="text-xs font-mono text-foreground truncate sm:hidden">{shortAddress}</p>
            <p className="text-xs font-mono text-foreground break-all hidden sm:block">{walletAddress}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={handleCopy} className="h-7 w-7 flex-shrink-0">
            {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
