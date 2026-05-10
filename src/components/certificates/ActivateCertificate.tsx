import { useState } from 'react';
import { useAccount } from 'wagmi';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { QrReader } from '@blackbox-vision/react-qr-reader';
import { ScanLine, Keyboard, Loader2, QrCode, X, Coins, CheckCircle2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { lookupCertificate, markCertificateMinted } from '@/lib/giftCertificates';
import { GiftCertificate } from '@/types/certificates';
import { useMintTokens } from '@/hooks/useMintTokens';

interface ActivateCertificateProps {
  onActivated?: () => void;
}

/**
 * UDS-style activation flow.
 *  - Cashier scans the QR shown by the customer OR types the 6-char code
 *  - We look up the certificate; if it's already claimed by the customer
 *    (status = pending_mint), we one-click mint to the recipient wallet.
 *  - If status = active, the customer must first activate it on their phone.
 */
export function ActivateCertificate({ onActivated }: ActivateCertificateProps) {
  const { address } = useAccount();
  const [code, setCode] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [looking, setLooking] = useState(false);
  const [cert, setCert] = useState<GiftCertificate | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { mintTokens, isPending, isSuccess, hash, reset } = useMintTokens();
  const [mintingId, setMintingId] = useState<string | null>(null);

  // Mark redeemed once mint tx confirms
  if (isSuccess && mintingId && hash) {
    markCertificateMinted(mintingId, hash).then((ok) => {
      if (ok) {
        toast.success('Certificate redeemed — tokens delivered to customer');
        setCert(null);
        setCode('');
        setMintingId(null);
        reset();
        onActivated?.();
      }
    });
  }

  const handleLookup = async (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    setError(null);
    setLooking(true);
    try {
      const found = await lookupCertificate(trimmed);
      if (!found) {
        setError('Certificate not found. Check the code and try again.');
        setCert(null);
        return;
      }
      // Verify it belongs to this merchant
      if (address && found.merchantAddress.toLowerCase() !== address.toLowerCase()) {
        setError('This certificate was issued by a different merchant.');
        setCert(null);
        return;
      }
      setCert(found);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lookup failed');
    } finally {
      setLooking(false);
    }
  };

  const handleMint = () => {
    if (!cert || !cert.redeemedBy) return;
    setMintingId(cert.id);
    mintTokens(cert.tokenAddress, cert.redeemedBy, String(cert.tokenAmount));
  };

  return (
    <>
      <Card className="border-2 border-dashed border-primary/30 bg-gradient-to-br from-primary/5 to-secondary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ScanLine className="h-5 w-5 text-primary" />
            Activate a customer's certificate
          </CardTitle>
          <CardDescription>
            Scan the QR shown on the customer's phone, or type the 6-character code they dictate.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="scan">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="scan"><QrCode className="h-4 w-4 mr-2" />Scan QR</TabsTrigger>
              <TabsTrigger value="code"><Keyboard className="h-4 w-4 mr-2" />Type code</TabsTrigger>
            </TabsList>

            <TabsContent value="scan" className="pt-3">
              <Button
                onClick={() => setScannerOpen(true)}
                className="w-full bg-gradient-to-r from-primary to-secondary"
              >
                <QrCode className="h-4 w-4 mr-2" />
                Open camera
              </Button>
            </TabsContent>

            <TabsContent value="code" className="space-y-3 pt-3">
              <Label className="text-xs">6-digit code from the customer</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="380 859"
                  inputMode="numeric"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s/g, ''))}
                  className="font-mono tracking-[0.4em] text-center text-lg"
                  maxLength={12}
                />
                <Button onClick={() => handleLookup(code)} disabled={looking || !code}>
                  {looking ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Find'}
                </Button>
              </div>
            </TabsContent>
          </Tabs>

          {error && (
            <Alert variant="destructive" className="mt-3">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* QR scanner */}
      <Dialog open={scannerOpen} onOpenChange={setScannerOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-4 w-4" />
              Scan customer's certificate
            </DialogTitle>
            <DialogDescription>
              Point the camera at the QR shown on the customer's phone.
            </DialogDescription>
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
                  handleLookup(text);
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

      {/* Certificate detail + mint action */}
      <Dialog open={!!cert} onOpenChange={(o) => !o && setCert(null)}>
        <DialogContent className="max-w-md">
          {cert && (
            <>
              <DialogHeader>
                <DialogTitle>{cert.title}</DialogTitle>
                <DialogDescription>
                  Issued by your business · code <span className="font-mono">{cert.code.replace('LOYAL-', '')}</span>
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3">
                <div className="text-center rounded-xl border bg-muted/30 p-4">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Value</p>
                  <p className="text-3xl font-bold">${cert.usdAmount}</p>
                  <p className="text-sm text-primary font-medium">
                    {cert.tokenAmount} {cert.tokenSymbol}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Up to {cert.maxRedemptionPercent}% off purchase
                  </p>
                </div>

                {cert.status === 'redeemed' && (
                  <Alert>
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertDescription>
                      Already redeemed{cert.redeemedAt ? ` on ${new Date(cert.redeemedAt).toLocaleDateString()}` : ''}.
                    </AlertDescription>
                  </Alert>
                )}

                {cert.status === 'expired' && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>This certificate has expired.</AlertDescription>
                  </Alert>
                )}

                {cert.status === 'revoked' && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>This certificate was revoked.</AlertDescription>
                  </Alert>
                )}

                {cert.status === 'active' && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      The customer hasn't activated this certificate yet. Ask them to open Loyal Spark on their phone and tap "Activate" in the gift card section. Then scan again.
                    </AlertDescription>
                  </Alert>
                )}

                {cert.status === 'pending_mint' && cert.redeemedBy && (
                  <>
                    <Alert>
                      <AlertDescription className="text-xs">
                        Customer wallet:&nbsp;
                        <span className="font-mono">
                          {cert.redeemedBy.slice(0, 6)}…{cert.redeemedBy.slice(-4)}
                        </span>
                      </AlertDescription>
                    </Alert>
                    <Button
                      onClick={handleMint}
                      disabled={isPending}
                      className="w-full bg-gradient-to-r from-primary to-secondary"
                      size="lg"
                    >
                      {isPending ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending tokens…</>
                      ) : (
                        <><Coins className="h-4 w-4 mr-2" /> Send {cert.tokenAmount} {cert.tokenSymbol} now</>
                      )}
                    </Button>
                  </>
                )}

                <Button variant="ghost" className="w-full" onClick={() => setCert(null)}>
                  Close
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
