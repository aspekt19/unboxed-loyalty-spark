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

  // Приоритет: сначала проверяем fallbackStatus из БД для критичных статусов
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

  // Если контракт новый и отвечает на проверки статуса
  if (!hasStatusErrors) {
    if (isPaused) {
      return (
        <Badge variant="secondary" className="bg-gray-500 text-white">
          Inactive
        </Badge>
      );
    }
    return (
      <Badge variant="default">
        Active
      </Badge>
    );
  }

  // Для старых контрактов (hasStatusErrors = true) показываем как активные
  return (
    <Badge variant="default">
      Active
    </Badge>
  );
}
