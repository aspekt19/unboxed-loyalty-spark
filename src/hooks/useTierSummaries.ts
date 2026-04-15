import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type TierSummary = {
  tierName: string | null;
  badgeColor: string | null;
  /** Short hint, e.g. "240 ABC to Gold" or null at max tier */
  toNextLine: string | null;
  /** Set when user is at highest configured tier */
  maxCashbackMultiplier?: number | null;
};

type TierRow = {
  token_address: string;
  tier_name: string;
  tier_level: number;
  min_tokens: number;
  badge_color: string;
  cashback_multiplier: number;
};

function summarizeForBalance(tiers: TierRow[], balanceNum: number, pointsLabel: string): TierSummary {
  if (!tiers.length) {
    return { tierName: null, badgeColor: null, toNextLine: null };
  }
  const sorted = [...tiers].sort((a, b) => a.tier_level - b.tier_level);
  const current = [...sorted].reverse().find((t) => balanceNum >= Number(t.min_tokens)) || null;
  const next = sorted.find((t) => t.tier_level > (current?.tier_level || 0)) || null;

  if (!current && !next) {
    return { tierName: null, badgeColor: null, toNextLine: null };
  }

  if (current && !next) {
    return {
      tierName: current.tier_name,
      badgeColor: current.badge_color,
      toNextLine: null,
      maxCashbackMultiplier: Number(current.cashback_multiplier) || null,
    };
  }

  if (current && next) {
    const need = Math.max(Number(next.min_tokens) - balanceNum, 0);
    return {
      tierName: current.tier_name,
      badgeColor: current.badge_color,
      toNextLine: `${need.toFixed(0)} ${pointsLabel} → ${next.tier_name}`,
    };
  }

  // Below first tier threshold
  const need = Math.max(Number(next!.min_tokens) - balanceNum, 0);
  return {
    tierName: null,
    badgeColor: null,
    toNextLine: `${need.toFixed(0)} ${pointsLabel} to ${next!.tier_name}`,
  };
}

/**
 * One batched read of customer_tiers for all given programs; recomputes when balances change.
 */
export function useTierSummaries(
  entries: readonly { tokenAddress: string; balance: string; symbol?: string }[],
): Record<string, TierSummary> {
  const [summaries, setSummaries] = useState<Record<string, TierSummary>>({});

  const key = useMemo(
    () => entries.map((e) => `${e.tokenAddress.toLowerCase()}:${e.balance}`).join('|'),
    [entries],
  );

  useEffect(() => {
    if (!entries.length) {
      setSummaries({});
      return;
    }

    let cancelled = false;
    const addrs = [...new Set(entries.map((e) => e.tokenAddress.toLowerCase()))];

    (async () => {
      const { data: rows, error } = await supabase
        .from('customer_tiers')
        .select('token_address, tier_name, tier_level, min_tokens, badge_color, cashback_multiplier')
        .in('token_address', addrs)
        .order('tier_level', { ascending: true });

      if (cancelled) return;
      if (error) {
        if (!cancelled) setSummaries({});
        return;
      }

      const byToken = new Map<string, TierRow[]>();
      for (const r of (rows || []) as TierRow[]) {
        const k = r.token_address.toLowerCase();
        const list = byToken.get(k) || [];
        list.push(r);
        byToken.set(k, list);
      }

      const out: Record<string, TierSummary> = {};
      for (const e of entries) {
        const k = e.tokenAddress.toLowerCase();
        const tiers = byToken.get(k) || [];
        const bal = parseFloat(e.balance) || 0;
        const label = (e.symbol && e.symbol.trim()) || 'pts';
        out[k] = summarizeForBalance(tiers, bal, label);
      }
      if (!cancelled) setSummaries(out);
    })();

    return () => {
      cancelled = true;
    };
  }, [key]);

  return summaries;
}
