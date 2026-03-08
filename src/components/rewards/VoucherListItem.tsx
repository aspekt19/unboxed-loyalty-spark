import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2 } from 'lucide-react';
import { Voucher } from '@/types/rewards';

interface VoucherListItemProps {
  voucher: Voucher;
  onMarkAsUsed?: (voucherId: string, code: string) => void;
}

export function VoucherListItem({ voucher, onMarkAsUsed }: VoucherListItemProps) {
  const isActive = voucher.status === 'active';
  const isUsed = voucher.status === 'used';
  const isInactive = voucher.status === 'expired';

  const statusConfig = {
    active: { label: 'Active', variant: 'default' as const, className: 'bg-primary/5' },
    used: { label: 'Used', variant: 'secondary' as const, className: 'opacity-60' },
    expired: { label: 'Inactive', variant: 'secondary' as const, className: 'bg-muted/50 opacity-70' },
  };

  const config = statusConfig[voucher.status] || statusConfig.active;

  return (
    <div className={`flex flex-col gap-2 p-2.5 border rounded-lg ${config.className}`}>
      <div className="space-y-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <code className="font-bold text-xs">{voucher.code}</code>
          <Badge variant={config.variant} className="text-[10px] px-1.5 py-0 h-4">
            {config.label}
          </Badge>
        </div>
        <div className="text-xs font-medium truncate">{voucher.rewardName}</div>
        <div className="text-[10px] text-muted-foreground">
          {isUsed && voucher.usedAt
            ? `Used: ${new Date(voucher.usedAt).toLocaleDateString()}`
            : `Activated: ${new Date(voucher.activatedAt).toLocaleDateString()}`}
        </div>
        <div className="text-[10px] text-muted-foreground">
          Customer: {voucher.customerAddress.slice(0, 6)}...{voucher.customerAddress.slice(-4)}
        </div>
        {isInactive && (
          <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
            Program is paused - voucher cannot be used
          </p>
        )}
      </div>
      {isActive && onMarkAsUsed && (
        <Button
          size="sm"
          onClick={() => onMarkAsUsed(voucher.id, voucher.code)}
          className="gap-1.5 h-7 w-full text-xs"
        >
          <CheckCircle2 className="h-3 w-3" />
          <span>Mark as Used</span>
        </Button>
      )}
    </div>
  );
}
