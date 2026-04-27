import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { QrReader } from '@blackbox-vision/react-qr-reader';
import { Gift, QrCode, Keyboard, Loader2, Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';
import { claimCertificate, lookupCertificate } from '@/lib/giftCertificates';
import { GiftCertificate } from '@/types/certificates';

export function RedeemCertificate({ onRedeemed }: { onRedeemed?: () => void }) {
  const [code, setCode] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [preview, setPreview] = useState<GiftCertificate | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handlePreview = async (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    setPreviewing(true);
    try {
      const cert = await lookupCertificate(trimmed);
      if (!cert) { toast.error('Certificate not found'); setPreview(null); return; }
      setPreview(cert);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Lookup failed');
    } finally {
      setPreviewing(false);
    }
  };

  const handleClaim = async () => {
    if (!preview) return;
    setSubmitting(true);
    try {
      const res = await claimCertificate(preview.code);
      if (!res.ok) {
        const map: Record<string, string> = {
          not_authenticated: 'Please sign in first',
          no_wallet: 'Connect a wallet first',
          not_found: 'Certificate not found',
          already_redeemed: 'Already redeemed',
          revoked: 'This certificate has been revoked',
          expired: 'This certificate has expired',
          cannot_claim_own: 'You cannot redeem your own certificate',
        };
        toast.error(map[res.error ?? ''] ?? res.error ?? 'Failed to redeem');
        return;
      }
      toast.success(`Certificate activated! The merchant will mint ${res.tokenAmount} tokens to your wallet shortly.`);
      setPreview(null);
      setCode('');
      onRedeemed?.();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="border-2 border-dashed border-primary/30 bg-gradient-to-br from-primary/5 to-secondary/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gift className="h-5 w-5 text-primary" />
          Redeem a Gift Certificate
        </CardTitle>
        <CardDescription>
          Got a gift certificate? Scan the QR or type the 6-character code to receive your loyalty tokens.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="code">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="code"><Keyboard className="h-4 w-4 mr-2" />Enter code</TabsTrigger>
            <TabsTrigger value="scan"><QrCode className="h-4 w-4 mr-2" />Scan QR</TabsTrigger>
          </TabsList>

          <TabsContent value="code" className="space-y-3 pt-3">
            <Label className="text-xs">6-character code</Label>
            <div className="flex gap-2">
              <Input
                placeholder="e.g. AB23CD"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="font-mono tracking-[0.3em] text-center uppercase"
                maxLength={12}
              />
              <Button onClick={() => handlePreview(code)} disabled={previewing || !code}>
                {previewing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Check'}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="scan" className="pt-3">
            <Button onClick={() => setScannerOpen(true)} className="w-full" variant="outline">
              <QrCode className="h-4 w-4 mr-2" /> Open camera
            </Button>
          </TabsContent>
        </Tabs>

        {preview && (
          <div className="mt-4 p-4 rounded-lg border-2 border-primary/30 bg-card space-y-3">
            {preview.imageUrl && (
              <img src={preview.imageUrl} alt={preview.title} className="w-full h-28 object-cover rounded" />
            )}
            <div className="text-center">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">{preview.title}</p>
              <p className="text-3xl font-bold mt-1">${preview.usdAmount}</p>
              <p className="text-sm text-primary font-medium">
                = {preview.tokenAmount} {preview.tokenSymbol}
              </p>
            </div>
            {preview.description && (
              <p className="text-xs text-center text-muted-foreground">{preview.description}</p>
            )}
            <Alert>
              <Sparkles className="h-4 w-4" />
              <AlertDescription className="text-xs">
                You'll be able to use these tokens for up to <strong>{preview.maxRedemptionPercent}%</strong> of any purchase at this merchant.
              </AlertDescription>
            </Alert>
            {preview.status !== 'active' ? (
              <Alert variant="destructive">
                <AlertDescription>This certificate is {preview.status} and cannot be redeemed.</AlertDescription>
              </Alert>
            ) : (
              <Button
                onClick={handleClaim}
                disabled={submitting}
                className="w-full bg-gradient-to-r from-primary to-secondary"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Gift className="h-4 w-4 mr-2" />Activate Certificate</>}
              </Button>
            )}
          </div>
        )}
      </CardContent>

      <Dialog open={scannerOpen} onOpenChange={setScannerOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-4 w-4" />
              Scan certificate QR
            </DialogTitle>
          </DialogHeader>
          <div className="rounded-lg overflow-hidden">
            <QrReader
              constraints={{ facingMode: 'environment' }}
              onResult={(result) => {
                if (!result) return;
                const text = result.getText();
                if (text) {
                  setCode(text);
                  setScannerOpen(false);
                  handlePreview(text);
                }
              }}
              videoStyle={{ width: '100%' }}
            />
          </div>
          <Button variant="ghost" onClick={() => setScannerOpen(false)}>
            <X className="h-4 w-4 mr-2" /> Cancel
          </Button>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
