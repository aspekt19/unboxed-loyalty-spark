import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { QrReader } from '@blackbox-vision/react-qr-reader';
import { QrCode, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface MintTokensDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (recipientAddress: string, amount: string) => void;
  isPending: boolean;
}

export function MintTokensDialog({ 
  isOpen, 
  onClose, 
  onSubmit, 
  isPending,
}: MintTokensDialogProps) {
  const [recipientAddress, setRecipientAddress] = useState('');
  const [mintAmount, setMintAmount] = useState('');
  const [showScanner, setShowScanner] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(recipientAddress, mintAmount);
    setRecipientAddress('');
    setMintAmount('');
    setShowScanner(false);
  };

  const handleScan = (result: any) => {
    if (result?.text) {
      setRecipientAddress(result.text);
      setShowScanner(false);
    }
  };

  const handleError = (error: any) => {
    console.error('QR scan error:', error);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Issue Loyalty Tokens</DialogTitle>
          <DialogDescription>
            Send tokens to your customer's wallet address
          </DialogDescription>
        </DialogHeader>
        
        {!showScanner ? (
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="recipient">Customer Wallet Address</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="default"
                  onClick={() => setShowScanner(true)}
                  className="h-9 px-3 border-primary/50 text-primary hover:bg-primary/10"
                >
                  <QrCode className="h-4 w-4 mr-1.5" />
                  Scan QR Code
                </Button>
              </div>
              <Input
                id="recipient"
                placeholder="0x..."
                value={recipientAddress}
                onChange={(e) => setRecipientAddress(e.target.value)}
                disabled={isPending}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="mint-amount">Amount</Label>
              <Input
                id="mint-amount"
                type="number"
                placeholder="0.00"
                value={mintAmount}
                onChange={(e) => setMintAmount(e.target.value)}
                disabled={isPending}
              />
            </div>
            
            <Button type="submit" disabled={isPending} className="w-full">
              Issue Tokens
            </Button>
          </form>
        ) : (
          <div className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <Label>Scan Customer's Wallet QR Code</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowScanner(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="relative aspect-square w-full max-w-sm mx-auto overflow-hidden rounded-lg border-2">
              <QrReader
                onResult={handleScan}
                constraints={{ facingMode: 'environment' }}
                containerStyle={{ width: '100%', height: '100%' }}
                videoStyle={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Position the QR code within the frame
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
