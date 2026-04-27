import { useEffect, useState, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { QRCodeSVG } from 'qrcode.react';
import { Gift, Loader2, QrCode, Copy, Check, Ban, Coins, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { GiftCertificate } from '@/types/certificates';
import {
  listMerchantCertificates,
  markCertificateMinted,
  revokeCertificate,
} from '@/lib/giftCertificates';
import { useMintTokens } from '@/hooks/useMintTokens';

const STATUS_VARIANT: Record<GiftCertificate['status'], 'default' | 'secondary' | 'destructive' | 'outline'> = {
  active: 'default',
  pending_mint: 'secondary',
  redeemed: 'outline',
  expired: 'destructive',
  revoked: 'destructive',
};

const STATUS_LABEL: Record<GiftCertificate['status'], string> = {
  active: 'Active',
  pending_mint: 'Awaiting mint',
  redeemed: 'Redeemed',
  expired: 'Expired',
  revoked: 'Revoked',
};

export function MerchantCertificatesList({ refreshKey = 0 }: { refreshKey?: number }) {
  const { address } = useAccount();
  const [certs, setCerts] = useState<GiftCertificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewCert, setPreviewCert] = useState<GiftCertificate | null>(null);
  const [mintingId, setMintingId] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const { mintTokens, isPending, isSuccess, hash, reset } = useMintTokens();

  const reload = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    try {
      setCerts(await listMerchantCertificates(address));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load certificates');
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => { reload(); }, [reload, refreshKey]);

  // After mint tx succeeds, mark certificate as redeemed
  useEffect(() => {
    if (isSuccess && mintingId && hash) {
      markCertificateMinted(mintingId, hash).then((ok) => {
        if (ok) {
          toast.success('Tokens delivered to customer!');
          setMintingId(null);
          reset();
          reload();
        }
      });
    }
  }, [isSuccess, mintingId, hash, reset, reload]);

  const handleMint = (cert: GiftCertificate) => {
    if (!cert.redeemedBy) return;
    setMintingId(cert.id);
    mintTokens(cert.tokenAddress, cert.redeemedBy, String(cert.tokenAmount));
  };

  const handleRevoke = async (cert: GiftCertificate) => {
    if (!confirm(`Revoke certificate ${cert.code}? This cannot be undone.`)) return;
    const ok = await revokeCertificate(cert.id);
    if (ok) { toast.success('Certificate revoked'); reload(); }
    else toast.error('Could not revoke (already used?)');
  };

  const handleCopy = async (code: string) => {
    await navigator.clipboard.writeText(code);
    setCopied(code);
    toast.success('Code copied');
    setTimeout(() => setCopied(null), 2000);
  };

  const pendingCount = certs.filter((c) => c.status === 'pending_mint').length;

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gift className="h-5 w-5 text-primary" />
          Issued Certificates
          {pendingCount > 0 && (
            <Badge variant="secondary" className="ml-auto animate-pulse">
              {pendingCount} awaiting mint
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Share QR codes or 6-character codes with customers. When they activate, you'll see a one-click button to mint their tokens on-chain.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {certs.length === 0 ? (
          <Alert><AlertDescription>No certificates yet. Create your first one above.</AlertDescription></Alert>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {certs.map((cert) => {
              const shortCode = cert.code.replace('LOYAL-', '');
              return (
                <div key={cert.id} className="rounded-lg border bg-card p-3 space-y-2 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm truncate">{cert.title}</p>
                      <p className="text-xs text-muted-foreground">
                        ${cert.usdAmount} · {cert.tokenAmount} {cert.tokenSymbol}
                      </p>
                    </div>
                    <Badge variant={STATUS_VARIANT[cert.status]} className="text-[10px]">
                      {STATUS_LABEL[cert.status]}
                    </Badge>
                  </div>

                  <button
                    onClick={() => handleCopy(shortCode)}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md bg-muted/50 hover:bg-muted font-mono text-sm tracking-wider transition-colors"
                  >
                    <span>{shortCode}</span>
                    {copied === shortCode ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
                  </button>

                  <div className="text-[11px] text-muted-foreground flex items-center justify-between">
                    <span>Up to {cert.maxRedemptionPercent}% off purchases</span>
                    {cert.expiresAt && <span>Exp {format(new Date(cert.expiresAt), 'MMM d')}</span>}
                  </div>

                  <div className="flex gap-2 pt-1">
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => setPreviewCert(cert)}>
                      <QrCode className="h-3.5 w-3.5 mr-1" /> View / Print
                    </Button>
                    {cert.status === 'pending_mint' && (
                      <Button
                        size="sm"
                        className="flex-1 bg-gradient-to-r from-primary to-secondary"
                        disabled={isPending && mintingId === cert.id}
                        onClick={() => handleMint(cert)}
                      >
                        {isPending && mintingId === cert.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <><Coins className="h-3.5 w-3.5 mr-1" /> Mint</>
                        )}
                      </Button>
                    )}
                    {cert.status === 'active' && (
                      <Button size="sm" variant="ghost" onClick={() => handleRevoke(cert)}>
                        <Ban className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* Preview dialog */}
      <Dialog open={!!previewCert} onOpenChange={(o) => !o && setPreviewCert(null)}>
        <DialogContent className="max-w-md print:shadow-none">
          {previewCert && (
            <>
              <DialogHeader>
                <DialogTitle>{previewCert.title}</DialogTitle>
                <DialogDescription>
                  Print or share this certificate with your customer.
                </DialogDescription>
              </DialogHeader>
              <div id="cert-print-area" className="space-y-3 p-4 rounded-xl border-2 border-dashed border-primary/40 bg-gradient-to-br from-primary/5 to-secondary/5">
                {previewCert.imageUrl && (
                  <img src={previewCert.imageUrl} alt={previewCert.title} className="w-full h-32 object-cover rounded-lg" />
                )}
                <div className="text-center">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">Gift Certificate</p>
                  <p className="text-2xl font-bold">${previewCert.usdAmount}</p>
                  <p className="text-sm text-primary font-medium">
                    {previewCert.tokenAmount} {previewCert.tokenSymbol}
                  </p>
                </div>
                <div className="flex justify-center bg-white p-3 rounded-lg">
                  <QRCodeSVG value={previewCert.code} size={160} level="H" />
                </div>
                <p className="text-center font-mono text-lg tracking-[0.3em]">
                  {previewCert.code.replace('LOYAL-', '')}
                </p>
                {previewCert.description && (
                  <p className="text-xs text-center text-muted-foreground">{previewCert.description}</p>
                )}
                <p className="text-[10px] text-center text-muted-foreground">
                  Use to cover up to {previewCert.maxRedemptionPercent}% of any purchase.
                  {previewCert.expiresAt && ` Valid until ${format(new Date(previewCert.expiresAt), 'PP')}.`}
                </p>
              </div>
              <Button onClick={() => window.print()} className="w-full" variant="outline">
                <Printer className="h-4 w-4 mr-2" /> Print
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
