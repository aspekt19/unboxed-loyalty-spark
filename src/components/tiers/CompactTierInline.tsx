import { Award } from 'lucide-react';
import type { TierSummary } from '@/hooks/useTierSummaries';

/** Single compact line: tier + optional progress hint (~1 line height). */
export function CompactTierInline({ summary }: { summary: TierSummary | undefined }) {
  const hasMax =
    summary &&
    summary.tierName &&
    !summary.toNextLine &&
    summary.maxCashbackMultiplier != null &&
    summary.maxCashbackMultiplier > 0;

  if (!summary || (!summary.tierName && !summary.toNextLine && !hasMax)) return null;

  return (
    <div className="flex items-center gap-1 min-w-0 text-[10px] leading-tight text-muted-foreground">
      <Award
        className="h-3 w-3 shrink-0 opacity-80"
        style={summary.badgeColor ? { color: summary.badgeColor } : undefined}
      />
      <span className="truncate">
        {summary.tierName && (
          <span className="font-medium text-foreground">{summary.tierName}</span>
        )}
        {summary.tierName && summary.toNextLine && <span className="text-muted-foreground"> · </span>}
        {summary.toNextLine && <span className="text-muted-foreground">{summary.toNextLine}</span>}
        {hasMax && (
          <span className="text-muted-foreground">
            {' '}
            · max · {summary.maxCashbackMultiplier}x
          </span>
        )}
      </span>
    </div>
  );
}
