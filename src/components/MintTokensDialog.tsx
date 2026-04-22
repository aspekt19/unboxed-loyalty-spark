import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { QrReader } from '@blackbox-vision/react-qr-reader';
import { QrCode, X, Mail, Phone, Wallet, Loader2 } from 'lucide-react';
import { useResolveRecipient } from '@/hooks/useResolveRecipient';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';

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
  const [recipientInput, setRecipientInput] = useState('');
  const [mintAmount, setMintAmount] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [inputType, setInputType] = useState<'wallet' | 'email' | 'phone'>('wallet');
  const { resolveRecipient, isResolving } = useResolveRecipient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const walletAddress = await resolveRecipient(recipientInput);
    if (!walletAddress) return;
    
    onSubmit(walletAddress, mintAmount);
    setRecipientInput('');
    setMintAmount('');
    setShowScanner(false);
  };

  const handleScan = (result: unknown) => {
    const text =
      (result as { text?: string } | null | undefined)?.text ??
      (result as { getText?: () => string } | null | undefined)?.getText?.();
    if (text) {
      setRecipientInput(text);
      setInputType('wallet');
      setShowScanner(false);
    }
  };

  const handleError = (error: unknown) => {
    console.error('QR scan error:', error);
  };

  const getPlaceholder = () => {
    switch (inputType) {
      case 'email': return 'customer@example.com';
      case 'phone': return '+1234567890';
      default: return '0x...';
    }
  };

  const getLabel = () => {
    switch (inputType) {
      case 'email': return 'Customer Email';
      case 'phone': return 'Customer Phone';
      default: return 'Customer Wallet Address';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Issue Loyalty Tokens</DialogTitle>
          <DialogDescription>
            Send tokens by wallet address, email, or phone number
          </DialogDescription>
        </DialogHeader>
        
        {!showScanner ? (
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{getLabel()}</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="default"
                  onClick={() => setShowScanner(true)}
                  className="h-9 px-3 border-primary/50 text-primary hover:bg-primary/10"
                >
                  <QrCode className="h-4 w-4 mr-1.5" />
                  Scan QR
                </Button>
              </div>
              
              <Tabs value={inputType} onValueChange={(v) => { setInputType(v as any); setRecipientInput(''); }}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="wallet" className="text-xs gap-1">
                    <Wallet className="h-3 w-3" /> Wallet
                  </TabsTrigger>
                  <TabsTrigger value="email" className="text-xs gap-1">
                    <Mail className="h-3 w-3" /> Email
                  </TabsTrigger>
                  <TabsTrigger value="phone" className="text-xs gap-1">
                    <Phone className="h-3 w-3" /> Phone
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              <Input
                placeholder={getPlaceholder()}
                value={recipientInput}
                onChange={(e) => setRecipientInput(e.target.value)}
                disabled={isPending || isResolving}
                type={inputType === 'email' ? 'email' : inputType === 'phone' ? 'tel' : 'text'}
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
                disabled={isPending || isResolving}
              />
            </div>
            
            <Button
              type="submit"
              disabled={isPending || isResolving}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 shadow-md"
            >
              {isResolving ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Looking up recipient...</>
              ) : (
                'Issue Tokens'
              )}
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
