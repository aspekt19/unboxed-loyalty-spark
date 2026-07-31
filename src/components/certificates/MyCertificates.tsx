import { useEffect, useState, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { QRCodeSVG } from 'qrcode.react';
import { Gift, Loader2, ExternalLink, ChevronRight, X } from 'lucide-react';
import { format } from 'date-fns';
import { enUS } from 'date-fns/locale';
import { GiftCertificate } from '@/types/certificates';
import { listCustomerCertificates } from '@/lib/giftCertificates';
import { readCache, writeCache, scopedKey, type CacheOptions } from '@/lib/localCache';


const STATUS_LABEL: Record<GiftCertificate['status'], string> = {
  active: 'Active',
  pending_mint: 'Ready to show',
  redeemed: 'Redeemed',
  expired: 'Expired',
  revoked: 'Revoked',
};

const isShowable = (s: GiftCertificate['status']) => s === 'active' || s === 'pending_mint';

// Strip "LOYAL-" prefix and format like UDS: "380 859"
function shortCode(code: string): string {
  return code.replace(/^LOYAL-/, '');
}
function formatCodeForDisplay(code: string): string {
  const c = shortCode(code);
  if (c.length <= 3) return c;
  const half = Math.ceil(c.length / 2);
  return `${c.slice(0, half)} ${c.slice(half)}`;
}

const CERTS_CACHE = 'certificates:customer';
const CACHE_OPTS: CacheOptions = { version: 1, ttlMs: 5 * 60 * 1000 };

export function MyCertificates() {
  const { address } = useAccount();
  const [certs, setCerts] = useState<GiftCertificate[]>(() =>
    readCache<GiftCertificate[]>(scopedKey(CERTS_CACHE, address), CACHE_OPTS) ?? []
  );
  const [loading, setLoading] = useState(
    () => !readCache<GiftCertificate[]>(scopedKey(CERTS_CACHE, address), CACHE_OPTS)
  );
  const [selected, setSelected] = useState<GiftCertificate | null>(null);

  const reload = useCallback(async () => {
    if (!address) return;
    const cached = readCache<GiftCertificate[]>(scopedKey(CERTS_CACHE, address), CACHE_OPTS);
    if (cached) setCerts(cached);
    setLoading(!cached);
    try {
      const fresh = await listCustomerCertificates(address);
      setCerts(fresh);
      writeCache(scopedKey(CERTS_CACHE, address), fresh, CACHE_OPTS);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void reload();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [reload]);


  if (!address || (!loading && certs.length === 0)) return null;

  const active = certs.filter((c) => isShowable(c.status));
  const archive = certs.filter((c) => !isShowable(c.status));

  // UDS-style row card: image on top, value + merchant + cap below
  const renderCard = (c: GiftCertificate) => (
    <button
      key={c.id}
      onClick={() => setSelected(c)}
      className="w-full text-left rounded-2xl bg-card border hover:shadow-md transition-all overflow-hidden group"
    >
      <div className="relative aspect-[16/9] bg-gradient-to-br from-rose-50 via-white to-rose-50 dark:from-rose-950/20 dark:via-background dark:to-rose-950/20 flex items-center justify-center overflow-hidden">
        {c.imageUrl ? (
          <img src={c.imageUrl} alt={c.title} className="w-full h-full object-cover" />
        ) : (
          <Gift className="h-24 w-24 text-rose-500/70 group-hover:scale-105 transition-transform" strokeWidth={1.5} />
        )}
      </div>
      <div className="p-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-2xl font-bold leading-tight">${c.usdAmount}</div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground mt-1 truncate">
            {c.title}
          </div>
          <div className="text-xs text-primary/80 mt-1.5">
            up to {c.maxRedemptionPercent}% off purchase
          </div>
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-1 group-hover:translate-x-0.5 transition-transform" />
      </div>
      <div className="px-4 pb-3 flex items-center justify-between text-[11px] text-muted-foreground border-t pt-2">
        <span>{c.expiresAt ? `Until ${format(new Date(c.expiresAt), 'PP', { locale: enUS })}` : 'No expiry'}</span>
        <Badge variant={c.status === 'pending_mint' ? 'default' : 'secondary'} className="text-[10px]">
          {STATUS_LABEL[c.status]}
        </Badge>
      </div>
    </button>
  );

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-primary" />
            My Gift Certificates
          </CardTitle>
          <CardDescription>
            Open any certificate and show its QR or tell the code to the cashier.
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
                    No certificates available right now.
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
                            ${c.usdAmount}
                            {c.redeemedAt && ` · ${format(new Date(c.redeemedAt), 'PP', { locale: enUS })}`}
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

      {/* UDS-style certificate detail */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
          {selected && (
            <div className="max-h-[90vh] overflow-y-auto">
              {/* Header with merchant title (like UDS top bar) */}
              <DialogHeader className="px-5 pt-5 pb-3 border-b">
                <DialogTitle className="text-center text-base">Certificate</DialogTitle>
              </DialogHeader>

              {/* Merchant strip */}
              <div className="px-5 py-3 flex items-center gap-3 border-b">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                  {selected.title.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm truncate uppercase tracking-wide">{selected.title}</p>
                  {selected.description && (
                    <p className="text-xs text-muted-foreground truncate">{selected.description}</p>
                  )}
                </div>
              </div>

              {/* Image */}
              <div className="px-5 pt-4">
                <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-rose-50 via-white to-rose-50 dark:from-rose-950/20 dark:via-background dark:to-rose-950/20 aspect-[16/10] flex items-center justify-center">
                  {selected.imageUrl ? (
                    <img src={selected.imageUrl} alt={selected.title} className="w-full h-full object-cover" />
                  ) : (
                    <Gift className="h-28 w-28 text-rose-500/70" strokeWidth={1.4} />
                  )}
                </div>
              </div>

              {/* Value + cap */}
              <div className="px-5 pt-5 text-center">
                <div className="text-4xl font-bold tracking-tight">${selected.usdAmount}</div>
                <p className="text-sm text-muted-foreground mt-1.5">
                  Pay up to <span className="text-primary font-medium">{selected.maxRedemptionPercent}%</span> of the bill
                </p>
              </div>

              {/* QR */}
              <div className="px-5 pt-5">
                <div className="flex justify-center bg-white rounded-2xl p-5 border">
                  <QRCodeSVG value={selected.code} size={200} level="H" />
                </div>
                {/* Big readable code, UDS-style */}
                <p className="text-center text-3xl font-bold font-mono tracking-[0.3em] mt-4 select-all">
                  {formatCodeForDisplay(selected.code)}
                </p>
              </div>

              {/* Validity + description blocks */}
              <div className="px-5 pt-5 pb-4 space-y-3">
                <div className="rounded-xl bg-muted/40 p-4 text-center">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Valid until</p>
                  <p className="text-sm font-medium">
                    {selected.expiresAt
                      ? format(new Date(selected.expiresAt), 'PP', { locale: enUS })
                      : 'No expiry'}
                  </p>
                </div>

                {selected.description && (
                  <div className="rounded-xl bg-muted/40 p-4 text-center">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Description</p>
                    <p className="text-sm">{selected.description}</p>
                  </div>
                )}

                {selected.status === 'pending_mint' && (
                  <p className="text-xs text-center text-muted-foreground px-2">
                    Tokens will land in your wallet right after the cashier confirms.
                  </p>
                )}
              </div>

              <div className="sticky bottom-0 bg-background/95 backdrop-blur border-t px-5 py-3">
                <Button variant="outline" className="w-full" onClick={() => setSelected(null)}>
                  <X className="h-4 w-4 mr-2" /> Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
