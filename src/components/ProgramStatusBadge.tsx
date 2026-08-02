import { Badge } from '@/components/ui/badge';
import { useCheckProgramStatus } from '@/hooks/useCheckProgramStatus';

interface ProgramStatusBadgeProps {
  tokenAddress?: string;
  fallbackStatus?: 'active' | 'pending' | 'expiring_soon' | 'expired' | 'paused' | 'inactive';
  expirationDate?: string;
  tokenStandard?: 'erc20' | 'b20';
  /** List UIs: trust DB status and skip per-card on-chain polls */
  preferDbStatus?: boolean;
}

export function ProgramStatusBadge({
  tokenAddress,
  fallbackStatus,
  expirationDate,
  tokenStandard = 'erc20',
  preferDbStatus = false,
}: ProgramStatusBadgeProps) {
  const { isPaused, hasStatusErrors } = useCheckProgramStatus(
    preferDbStatus ? undefined : (tokenAddress as `0x${string}` | undefined),
    tokenStandard,
  );

  const isExpired = expirationDate && new Date(expirationDate) < new Date();

  if (!tokenAddress) {
    return (
      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
        {fallbackStatus || 'Pending'}
      </Badge>
    );
  }

  if (isExpired || fallbackStatus === 'expired') {
    return (
      <Badge variant="secondary" className="bg-red-600 text-white text-[10px] px-1.5 py-0 h-5">
        Expired
      </Badge>
    );
  }

  if (preferDbStatus) {
    if (fallbackStatus === 'paused' || fallbackStatus === 'inactive') {
      return (
        <Badge variant="secondary" className="bg-gray-500 text-white text-[10px] px-1.5 py-0 h-5">
          Inactive
        </Badge>
      );
    }
    if (fallbackStatus === 'expiring_soon') {
      return (
        <Badge variant="destructive" className="bg-amber-600 text-[10px] px-1.5 py-0 h-5">
          Expiring Soon
        </Badge>
      );
    }
    return (
      <Badge variant="default" className="text-[10px] px-1.5 py-0 h-5">
        Active
      </Badge>
    );
  }

  // For B20 skip on-chain "paused" — the concept doesn't exist there.
  if (tokenStandard !== 'b20' && !hasStatusErrors && isPaused) {
    return (
      <Badge variant="secondary" className="bg-gray-500 text-white text-[10px] px-1.5 py-0 h-5">
        Inactive
      </Badge>
    );
  }

  if (
    (fallbackStatus === 'paused' || fallbackStatus === 'inactive') &&
    !isExpired
  ) {
    return (
      <Badge variant="secondary" className="bg-gray-500 text-white text-[10px] px-1.5 py-0 h-5">
        Inactive
      </Badge>
    );
  }

  if (fallbackStatus === 'expiring_soon') {
    return (
      <Badge variant="destructive" className="bg-amber-600 text-[10px] px-1.5 py-0 h-5">
        Expiring Soon
      </Badge>
    );
  }

  return (
    <Badge variant="default" className="text-[10px] px-1.5 py-0 h-5">
      Active
    </Badge>
  );
}
