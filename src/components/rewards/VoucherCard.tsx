import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Voucher } from '@/types/rewards';
import { Ticket, Calendar, Copy, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useState } from 'react';

interface VoucherCardProps {
  voucher: Voucher;
}

export function VoucherCard({ voucher }: VoucherCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(voucher.code);
      setCopied(true);
      toast.success('Code copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Failed to copy code');
    }
  };

  const getStatusColor = () => {
    switch (voucher.status) {
      case 'active':
        return 'default';
      case 'used':
        return 'secondary';
      case 'expired':
        return 'destructive';
      default:
        return 'default';
    }
  };

  const getStatusLabel = () => {
    switch (voucher.status) {
      case 'active':
        return 'Active';
      case 'used':
        return 'Used';
      case 'expired':
        return 'Expired';
      default:
        return voucher.status;
    }
  };

  return (
    <Card className={`border-2 ${voucher.status === 'active' ? 'bg-gradient-to-br from-card to-primary/5' : 'opacity-60'}`}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 min-w-0 flex-1">
            <div className="p-1.5 rounded-lg bg-primary/10 flex-shrink-0">
              <Ticket className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm truncate">{voucher.rewardName}</h3>
              <p className="text-xs text-muted-foreground line-clamp-2">{voucher.rewardDescription}</p>
            </div>
          </div>
          <Badge variant={getStatusColor()} className="text-[10px] px-1.5 py-0 h-5 flex-shrink-0">{getStatusLabel()}</Badge>
        </div>

        <div className="p-3 bg-muted rounded-lg space-y-1.5">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Voucher Code</div>
          <div className="flex items-center justify-between gap-2">
            <code className="text-sm font-bold tracking-wider break-all flex-1">{voucher.code}</code>
            <Button
              size="icon"
              variant="ghost"
              onClick={handleCopy}
              disabled={copied}
              className="h-7 w-7 flex-shrink-0"
            >
              {copied ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="space-y-0.5">
            <div className="text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Activated
            </div>
            <div className="font-medium">
              {new Date(voucher.activatedAt).toLocaleDateString()}
            </div>
          </div>
          <div className="space-y-0.5">
            <div className="text-muted-foreground">Program</div>
            <div className="font-medium truncate">{voucher.tokenSymbol}</div>
          </div>
          {voucher.status === 'used' && voucher.usedAt && (
            <div className="col-span-2 space-y-0.5">
              <div className="text-muted-foreground flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Used on
              </div>
              <div className="font-medium">
                {new Date(voucher.usedAt).toLocaleDateString()}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
