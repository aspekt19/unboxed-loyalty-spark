import { Badge } from '@/components/ui/badge';
import { useCheckProgramStatus } from '@/hooks/useCheckProgramStatus';
import { Loader2 } from 'lucide-react';

interface ProgramStatusBadgeProps {
  tokenAddress?: string;
  fallbackStatus?: 'active' | 'pending' | 'expiring_soon' | 'expired';
}

export function ProgramStatusBadge({ tokenAddress, fallbackStatus }: ProgramStatusBadgeProps) {
  const { isPaused, isMintingActive, isUtilityActive, hasStatusErrors } = useCheckProgramStatus(
    tokenAddress as `0x${string}` | undefined
  );

  if (!tokenAddress) {
    return <Badge variant="secondary">{fallbackStatus || 'Pending'}</Badge>;
  }

  // Для старых контрактов (где есть ошибки при проверке) используем fallbackStatus из БД
  if (hasStatusErrors) {
    if (fallbackStatus === 'expired') {
      return (
        <Badge variant="secondary" className="bg-red-600 text-white">
          Expired
        </Badge>
      );
    }
    if (fallbackStatus === 'expiring_soon') {
      return (
        <Badge variant="destructive" className="bg-amber-600">
          Expiring Soon
        </Badge>
      );
    }
    // Для старых контрактов показываем их как активные, если нет другого статуса
    return (
      <Badge variant="default">
        Active (Legacy)
      </Badge>
    );
  }

  // Для новых контрактов проверяем isPaused из контракта
  if (isPaused) {
    return (
      <Badge variant="secondary" className="bg-gray-500 text-white">
        Inactive
      </Badge>
    );
  }

  // Показываем статус "Expired" для истекших программ
  if (fallbackStatus === 'expired') {
    return (
      <Badge variant="secondary" className="bg-red-600 text-white">
        Expired
      </Badge>
    );
  }

  if (fallbackStatus === 'expiring_soon') {
    return (
      <Badge variant="destructive" className="bg-amber-600">
        Expiring Soon
      </Badge>
    );
  }

  return (
    <Badge variant="default">
      Active
    </Badge>
  );
}
