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
      <CardContent className="p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Ticket className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">{voucher.rewardName}</h3>
              <p className="text-sm text-muted-foreground">{voucher.rewardDescription}</p>
            </div>
          </div>
          <Badge variant={getStatusColor()}>{getStatusLabel()}</Badge>
        </div>

        <div className="p-4 bg-muted rounded-lg space-y-2">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Voucher Code</div>
          <div className="flex items-center justify-between gap-2">
            <code className="text-2xl font-bold tracking-wider">{voucher.code}</code>
            <Button
              size="icon"
              variant="ghost"
              onClick={handleCopy}
              disabled={copied}
            >
              {copied ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="space-y-1">
            <div className="text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Activated
            </div>
            <div className="font-medium">
              {new Date(voucher.activatedAt).toLocaleDateString()}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-muted-foreground">Program</div>
            <div className="font-medium">{voucher.tokenSymbol}</div>
          </div>
          {voucher.status === 'used' && voucher.usedAt && (
            <div className="col-span-2 space-y-1">
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
