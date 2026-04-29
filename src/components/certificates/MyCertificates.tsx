import { useEffect, useState, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { QRCodeSVG } from 'qrcode.react';
import { Gift, Loader2, ExternalLink, QrCode, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { GiftCertificate } from '@/types/certificates';
import { listCustomerCertificates } from '@/lib/giftCertificates';

const STATUS_LABEL: Record<GiftCertificate['status'], string> = {
  active: 'Active',
  pending_mint: 'Show to cashier',
  redeemed: 'Redeemed',
  expired: 'Expired',
  revoked: 'Revoked',
};

const isShowable = (s: GiftCertificate['status']) => s === 'active' || s === 'pending_mint';

export function MyCertificates() {
  const { address } = useAccount();
  const [certs, setCerts] = useState<GiftCertificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<GiftCertificate | null>(null);

  const reload = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    try {
      setCerts(await listCustomerCertificates(address));
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => { reload(); }, [reload]);

  if (!address || (!loading && certs.length === 0)) return null;

  const active = certs.filter((c) => isShowable(c.status));
  const archive = certs.filter((c) => !isShowable(c.status));

  const renderCard = (c: GiftCertificate) => {
    const shortCode = c.code.replace('LOYAL-', '');
    return (
      <button
        key={c.id}
        onClick={() => setSelected(c)}
        className="w-full text-left rounded-2xl bg-card border hover:shadow-lg transition-all overflow-hidden group"
      >
        {/* Image header (gift-box style — UDS-like) */}
        <div className="relative aspect-[16/9] bg-gradient-to-br from-primary/10 via-primary/5 to-secondary/10 flex items-center justify-center overflow-hidden">
          {c.imageUrl ? (
            <img src={c.imageUrl} alt={c.title} className="w-full h-full object-cover" />
          ) : (
            <Gift className="h-20 w-20 text-primary/60 group-hover:scale-110 transition-transform" />
          )}
        </div>
        {/* Body */}
        <div className="p-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-2xl font-bold leading-tight">
              {c.tokenAmount} <span className="text-base font-medium text-muted-foreground">{c.tokenSymbol}</span>
            </div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground mt-1 truncate">
              {c.title}
            </div>
            <div className="text-xs text-primary/80 mt-1.5">
              up to {c.maxRedemptionPercent}% off purchase
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-1 group-hover:translate-x-0.5 transition-transform" />
        </div>
        <div className="px-4 pb-3 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>{c.expiresAt ? `Until ${format(new Date(c.expiresAt), 'PP')}` : 'No expiry'}</span>
          <Badge variant={c.status === 'pending_mint' ? 'default' : 'secondary'} className="text-[10px]">
            {STATUS_LABEL[c.status]}
          </Badge>
        </div>
      </button>
    );
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-primary" />
            My Gift Certificates
          </CardTitle>
          <CardDescription>
            Tap a certificate, then show the QR or 6-digit code to the cashier.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Tabs defaultValue="active">
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="active">
                  Active {active.length > 0 && <span className="ml-1.5 text-[10px] bg-primary/15 text-primary rounded-full px-1.5 py-0.5">{active.length}</span>}
                </TabsTrigger>
                <TabsTrigger value="archive">
                  Archive {archive.length > 0 && <span className="ml-1.5 text-[10px] bg-muted rounded-full px-1.5 py-0.5">{archive.length}</span>}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="active" className="pt-4">
                {active.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    No active certificates yet. Got a gift code? Activate it above.
                  </p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {active.map(renderCard)}
                  </div>
                )}
              </TabsContent>
              <TabsContent value="archive" className="pt-4">
                {archive.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No history yet.</p>
                ) : (
                  <div className="space-y-2">
                    {archive.map((c) => (
                      <div key={c.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-card/50">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{c.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {c.tokenAmount} {c.tokenSymbol}
                            {c.redeemedAt && ` · ${format(new Date(c.redeemedAt), 'PP')}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Badge variant="outline" className="text-[10px]">{STATUS_LABEL[c.status]}</Badge>
                          {c.mintTxHash && (
                            <a href={`https://basescan.org/tx/${c.mintTxHash}`} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>

      {/* Detail dialog — UDS-style: large QR + big readable code */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-md">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="text-center">Certificate</DialogTitle>
                <DialogDescription className="text-center">
                  Show this screen to the cashier
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 pt-2">
                {/* Image */}
                <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-primary/10 to-secondary/10 aspect-[16/9] flex items-center justify-center">
                  {selected.imageUrl ? (
                    <img src={selected.imageUrl} alt={selected.title} className="w-full h-full object-cover" />
                  ) : (
                    <Gift className="h-24 w-24 text-primary/60" />
                  )}
                </div>

                {/* Value + cap */}
                <div className="text-center">
                  <div className="text-3xl font-bold">${selected.usdAmount}</div>
                  <div className="text-sm text-primary font-medium mt-1">
                    {selected.tokenAmount} {selected.tokenSymbol}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Pay up to {selected.maxRedemptionPercent}% of the bill
                  </div>
                </div>

                {/* QR */}
                <div className="flex justify-center bg-white p-4 rounded-2xl border">
                  <QRCodeSVG value={selected.code} size={200} level="H" />
                </div>

                {/* 6-digit code (large, spaced — like UDS) */}
                <div className="text-center">
                  <p className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1">
                    Or dictate this code
                  </p>
                  <p className="text-3xl font-bold font-mono tracking-[0.4em] select-all">
                    {shortFormat(selected.code.replace('LOYAL-', ''))}
                  </p>
                </div>

                {/* Validity / description */}
                <div className="rounded-xl border bg-muted/30 p-3 text-xs text-center space-y-1">
                  <p className="text-muted-foreground">Valid until</p>
                  <p className="font-medium">
                    {selected.expiresAt ? format(new Date(selected.expiresAt), 'PP') : 'No expiry'}
                  </p>
                  {selected.description && (
                    <p className="text-muted-foreground pt-2 border-t mt-2">{selected.description}</p>
                  )}
                </div>

                {selected.status === 'pending_mint' && (
                  <p className="text-xs text-center text-primary/80">
                    <QrCode className="h-3 w-3 inline mr-1" />
                    Tokens will be sent to your wallet right after the cashier scans.
                  </p>
                )}

                <Button variant="outline" className="w-full" onClick={() => setSelected(null)}>
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

// Format 6-char code as "ABC DEF" for easier reading/dictation (UDS-style)
function shortFormat(code: string): string {
  if (code.length <= 3) return code;
  const half = Math.ceil(code.length / 2);
  return `${code.slice(0, half)} ${code.slice(half)}`;
}
