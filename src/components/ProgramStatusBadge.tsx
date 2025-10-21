import { Badge } from '@/components/ui/badge';
import { useCheckProgramStatus } from '@/hooks/useCheckProgramStatus';
import { Loader2 } from 'lucide-react';

interface ProgramStatusBadgeProps {
  tokenAddress?: string;
  fallbackStatus?: 'active' | 'pending' | 'expiring_soon' | 'expired';
}

export function ProgramStatusBadge({ tokenAddress, fallbackStatus }: ProgramStatusBadgeProps) {
  const { isPaused, isMintingActive, isUtilityActive } = useCheckProgramStatus(
    tokenAddress as `0x${string}` | undefined
  );

  if (!tokenAddress) {
    return <Badge variant="secondary">{fallbackStatus || 'Pending'}</Badge>;
  }

  if (isPaused) {
    return (
      <Badge variant="secondary" className="bg-gray-500 text-white">
        Деактивирована
      </Badge>
    );
  }

  if (fallbackStatus === 'expiring_soon') {
    return (
      <Badge variant="destructive" className="bg-amber-600">
        Истекает скоро
      </Badge>
    );
  }

  return (
    <Badge variant="default">
      Активна
    </Badge>
  );
}
