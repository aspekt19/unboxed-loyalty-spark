import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  CACHE_INVALIDATED_EVENT,
  invalidateCache,
  readCache,
  writeCache,
  type CacheOptions,
} from '@/lib/localCache';

export interface RealtimeWatch {
  table: string;
  /** PostgREST filter, e.g. `merchant_address=eq.0x…` */
  filter?: string;
}

export interface UseCachedResourceOptions<T> extends CacheOptions {
  /** Cache key; pass null to disable (e.g. wallet not connected). */
  key: string | null;
  fetcher: () => Promise<T>;
  /** Rendered before the first successful fetch when no snapshot exists. */
  initialData: T;
  /** Supabase tables that should trigger a background refresh. */
  realtime?: RealtimeWatch[];
  /** Custom window events that should trigger a background refresh. */
  events?: string[];
  /** Refresh when the tab becomes visible again. Default true. */
  revalidateOnFocus?: boolean;
  enabled?: boolean;
}

export interface CachedResource<T> {
  data: T;
  /** True only when there is nothing to show yet (no cache, first load). */
  isLoading: boolean;
  /** True while a background refresh is in flight. */
  isValidating: boolean;
  error: Error | null;
  /** Whether the current data came from the cache and not yet from network. */
  isStale: boolean;
  refresh: () => void;
  /** Drop the snapshot and refetch. */
  invalidate: () => void;
  /** Optimistically replace data (also updates the snapshot). */
  mutate: (updater: T | ((prev: T) => T)) => void;
}

/**
 * Stale-while-revalidate data hook.
 *
 * Renders the last known snapshot immediately, then refreshes in the
 * background. Snapshots expire (TTL) and are invalidated by realtime
 * changes, custom events, tab focus and explicit mutations, so the UI is
 * fast without ever showing data the backend has already superseded.
 */
export function useCachedResource<T>(options: UseCachedResourceOptions<T>): CachedResource<T> {
  const {
    key,
    fetcher,
    initialData,
    realtime,
    events,
    revalidateOnFocus = true,
    enabled = true,
    version,
    ttlMs,
  } = options;

  const cacheOpts: CacheOptions = { version, ttlMs };
  const cacheOptsRef = useRef(cacheOpts);
  cacheOptsRef.current = cacheOpts;

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const active = enabled && !!key;

  const readSnapshot = useCallback(
    (k: string | null) => (k ? readCache<T>(k, cacheOptsRef.current) : null),
    [],
  );

  const [state, setState] = useState(() => {
    const cached = readSnapshot(key);
    return {
      data: cached ?? initialData,
      isStale: cached !== null,
      isLoading: active && cached === null,
    };
  });
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const keyRef = useRef(key);
  const requestIdRef = useRef(0);

  // Re-seed from cache whenever the key changes (wallet / token switch)
  useEffect(() => {
    keyRef.current = key;
    const cached = readSnapshot(key);
    setState({
      data: cached ?? initialData,
      isStale: cached !== null,
      isLoading: (enabled && !!key) && cached === null,
    });
    // initialData is intentionally excluded: callers often pass a new literal
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled, readSnapshot]);

  const load = useCallback(async () => {
    const k = keyRef.current;
    if (!k || !enabled) return;
    const id = ++requestIdRef.current;
    setIsValidating(true);
    try {
      const result = await fetcherRef.current();
      if (id !== requestIdRef.current || keyRef.current !== k) return;
      writeCache(k, result, cacheOptsRef.current);
      setState({ data: result, isStale: false, isLoading: false });
      setError(null);
    } catch (err) {
      if (id !== requestIdRef.current) return;
      setError(err instanceof Error ? err : new Error(String(err)));
      setState((prev) => ({ ...prev, isLoading: false }));
    } finally {
      if (id === requestIdRef.current) setIsValidating(false);
    }
  }, [enabled]);

  // Initial + key-change fetch
  useEffect(() => {
    if (!active) return;
    void load();
  }, [active, key, load]);

  // Realtime invalidation
  useEffect(() => {
    if (!active || !realtime?.length) return;
    const channelName = `cache:${key}:${realtime.map((r) => r.table).join(',')}`;
    const channel = supabase.channel(channelName);
    realtime.forEach(({ table, filter }) => {
      channel.on(
        'postgres_changes' as never,
        { event: '*', schema: 'public', table, ...(filter ? { filter } : {}) } as never,
        () => {
          void load();
        },
      );
    });
    channel.subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
    // realtime array identity changes each render for inline literals; key it by content
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, key, load, JSON.stringify(realtime ?? [])]);

  // Custom window events + explicit cache invalidation
  useEffect(() => {
    if (!active) return;
    const onRefresh = () => void load();
    const onInvalidated = (e: Event) => {
      const detailKey = (e as CustomEvent<{ key?: string }>).detail?.key;
      if (!detailKey || !keyRef.current) return;
      if (keyRef.current === detailKey || keyRef.current.startsWith(detailKey)) void load();
    };
    (events ?? []).forEach((evt) => window.addEventListener(evt, onRefresh));
    window.addEventListener(CACHE_INVALIDATED_EVENT, onInvalidated as EventListener);
    return () => {
      (events ?? []).forEach((evt) => window.removeEventListener(evt, onRefresh));
      window.removeEventListener(CACHE_INVALIDATED_EVENT, onInvalidated as EventListener);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, load, (events ?? []).join(',')]);

  // Revalidate when the tab regains focus
  useEffect(() => {
    if (!active || !revalidateOnFocus) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [active, revalidateOnFocus, load]);

  const mutate = useCallback((updater: T | ((prev: T) => T)) => {
    setState((prev) => {
      const next =
        typeof updater === 'function' ? (updater as (p: T) => T)(prev.data) : updater;
      if (keyRef.current) writeCache(keyRef.current, next, cacheOptsRef.current);
      return { data: next, isStale: false, isLoading: false };
    });
  }, []);

  const invalidate = useCallback(() => {
    if (keyRef.current) invalidateCache(keyRef.current);
    void load();
  }, [load]);

  return {
    data: state.data,
    isLoading: state.isLoading,
    isValidating,
    error,
    isStale: state.isStale,
    refresh: () => void load(),
    invalidate,
    mutate,
  };
}
