import { Badge } from '@/components/ui/badge';
import { useCheckProgramStatus } from '@/hooks/useCheckProgramStatus';
import { Loader2 } from 'lucide-react';

interface ProgramStatusBadgeProps {
  tokenAddress?: string;
  fallbackStatus?: 'active' | 'pending' | 'expiring_soon' | 'expired';
  expirationDate?: string;
}

export function ProgramStatusBadge({ tokenAddress, fallbackStatus, expirationDate }: ProgramStatusBadgeProps) {
  const { isPaused, isMintingActive, isUtilityActive, hasStatusErrors } = useCheckProgramStatus(
    tokenAddress as `0x${string}` | undefined
  );

  // Проверяем реальную дату экспирации
  const isExpired = expirationDate && new Date(expirationDate) < new Date();
  
  // Логируем для отладки
  console.log(`[StatusBadge] Token: ${tokenAddress?.slice(0, 8)}...`, {
    fallbackStatus,
    expirationDate,
    isExpired,
    isPaused,
    hasStatusErrors,
    isMintingActive,
    isUtilityActive
  });

  if (!tokenAddress) {
    return <Badge variant="secondary">{fallbackStatus || 'Pending'}</Badge>;
  }

  // Приоритет 1: Проверяем реальную дату экспирации
  if (isExpired) {
    console.log(`[StatusBadge] Showing Expired for ${tokenAddress?.slice(0, 8)}... (date expired)`);
    return (
      <Badge variant="secondary" className="bg-red-600 text-white">
        Expired
      </Badge>
    );
  }

  // Приоритет 2: Если контракт новый (отвечает на проверки статуса), проверяем isPaused
  if (!hasStatusErrors && isPaused) {
    console.log(`[StatusBadge] Showing Inactive for ${tokenAddress?.slice(0, 8)}... (contract paused)`);
    return (
      <Badge variant="secondary" className="bg-gray-500 text-white">
        Inactive
      </Badge>
    );
  }

  // Приоритет 3: Проверяем fallbackStatus из БД (только для старых контрактов или если не истекла дата)
  if (fallbackStatus === 'expired' && !isExpired) {
    // Если в БД expired но дата не истекла - это manual pause, показываем Inactive
    console.log(`[StatusBadge] Showing Inactive for ${tokenAddress?.slice(0, 8)}... (DB expired but date valid)`);
    return (
      <Badge variant="secondary" className="bg-gray-500 text-white">
        Inactive
      </Badge>
    );
  }

  if (fallbackStatus === 'expiring_soon') {
    console.log(`[StatusBadge] Showing Expiring Soon for ${tokenAddress?.slice(0, 8)}...`);
    return (
      <Badge variant="destructive" className="bg-amber-600">
        Expiring Soon
      </Badge>
    );
  }

  // Для всех остальных случаев (активные новые и старые контракты) - Active
  console.log(`[StatusBadge] Showing Active for ${tokenAddress?.slice(0, 8)}...`);
  return (
    <Badge variant="default">
      Active
    </Badge>
  );
}
