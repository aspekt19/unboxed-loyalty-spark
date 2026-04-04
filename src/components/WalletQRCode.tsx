import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { QRCodeSVG } from 'qrcode.react';
import { useAccount } from 'wagmi';
import { QrCode, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
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
  const [copied, setCopied] = useState(false);

  if (!address) return null;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    toast.success('Wallet address copied!');
    setTimeout(() => setCopied(false), 2000);
  };

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
                value={address}
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
                  value={address}
                  size={240}
                  level="H"
                  includeMargin
                />
              </div>
              <p className="text-xs text-muted-foreground font-mono text-center break-all px-4">
                {address}
              </p>
              <Button variant="outline" size="sm" onClick={handleCopy} className="gap-2">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copied!' : 'Copy Address'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Button variant="outline" size="sm" onClick={handleCopy} className="gap-2 text-xs">
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? 'Copied!' : 'Copy Address'}
        </Button>
      </CardContent>
    </Card>
  );
}
