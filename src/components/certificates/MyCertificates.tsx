import { useEffect, useState, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Gift, Loader2, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { GiftCertificate } from '@/types/certificates';
import { listCustomerCertificates } from '@/lib/giftCertificates';

const STATUS_LABEL: Record<GiftCertificate['status'], string> = {
  active: 'Active',
  pending_mint: 'Tokens on the way',
  redeemed: 'Tokens received',
  expired: 'Expired',
  revoked: 'Revoked',
};

export function MyCertificates() {
  const { address } = useAccount();
  const [certs, setCerts] = useState<GiftCertificate[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    try { setCerts(await listCustomerCertificates(address)); } finally { setLoading(false); }
  }, [address]);

  useEffect(() => { reload(); }, [reload]);

  if (!address || (!loading && certs.length === 0)) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gift className="h-5 w-5 text-primary" />
          My Gift Certificates
        </CardTitle>
        <CardDescription>Certificates you've activated</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-2">
            {certs.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-card">
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{c.title}</p>
                  <p className="text-xs text-muted-foreground">
                    ${c.usdAmount} · {c.tokenAmount} {c.tokenSymbol}
                    {c.redeemedAt && ` · ${format(new Date(c.redeemedAt), 'PP')}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={c.status === 'redeemed' ? 'default' : 'secondary'} className="text-[10px]">
                    {STATUS_LABEL[c.status]}
                  </Badge>
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
      </CardContent>
    </Card>
  );
}
