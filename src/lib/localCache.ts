/**
 * Shared stale-while-revalidate cache backed by localStorage.
 *
 * Goals:
 *  - Portals paint instantly from the last known snapshot.
 *  - Snapshots are versioned + time-boxed, so stale data never sticks around.
 *  - Any writer (mutation, realtime event, other tab) can invalidate a key.
 *
 * Security note: only non-sensitive, already user-visible data belongs here.
 * Never cache tokens, keys or anything that is not returned by an RLS-guarded
 * query for the currently connected wallet.
 */

const PREFIX = 'lsc:';
/** Bump to drop every snapshot written by an older build. */
const GLOBAL_VERSION = 1;

export const CACHE_INVALIDATED_EVENT = 'ls-cache-invalidated';

interface Envelope<T> {
  v: number;
  gv: number;
  ts: number;
  data: T;
}

export interface CacheOptions {
  /** Per-key schema version. Bump when the cached shape changes. */
  version?: number;
  /** Max age before the snapshot is considered unusable. Default 5 min. */
  ttlMs?: number;
}

const DEFAULT_TTL_MS = 5 * 60 * 1000;

function storageKey(key: string) {
  return `${PREFIX}${key}`;
}

/** Build a cache key scoped to a wallet (or any owner id), lower-cased. */
export function scopedKey(namespace: string, owner?: string | null): string {
  return owner ? `${namespace}:${owner.toLowerCase()}` : namespace;
}

export function readCache<T>(key: string, options: CacheOptions = {}): T | null {
  const { version = 1, ttlMs = DEFAULT_TTL_MS } = options;
  const sk = storageKey(key);
  try {
    const raw = localStorage.getItem(sk);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Envelope<T>;
    if (!parsed || typeof parsed !== 'object') {
      localStorage.removeItem(sk);
      return null;
    }
    if (parsed.gv !== GLOBAL_VERSION || parsed.v !== version) {
      localStorage.removeItem(sk);
      return null;
    }
    if (typeof parsed.ts !== 'number' || Date.now() - parsed.ts > ttlMs) {
      localStorage.removeItem(sk);
      return null;
    }
    return parsed.data;
  } catch {
    try {
      localStorage.removeItem(sk);
    } catch {
      /* ignore */
    }
    return null;
  }
}

export function writeCache<T>(key: string, data: T, options: CacheOptions = {}): void {
  const { version = 1 } = options;
  try {
    const envelope: Envelope<T> = { v: version, gv: GLOBAL_VERSION, ts: Date.now(), data };
    localStorage.setItem(storageKey(key), JSON.stringify(envelope));
  } catch {
    /* quota / private mode — cache is best-effort */
  }
}

/** Drop one snapshot and notify listeners in this tab. */
export function invalidateCache(key: string): void {
  try {
    localStorage.removeItem(storageKey(key));
  } catch {
    /* ignore */
  }
  try {
    window.dispatchEvent(new CustomEvent(CACHE_INVALIDATED_EVENT, { detail: { key } }));
  } catch {
    /* ignore */
  }
}

/** Drop every snapshot whose key starts with `prefix` (e.g. "rewards:"). */
export function invalidateCacheByPrefix(prefix: string): void {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(storageKey(prefix)))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
  try {
    window.dispatchEvent(new CustomEvent(CACHE_INVALIDATED_EVENT, { detail: { key: prefix } }));
  } catch {
    /* ignore */
  }
}

/**
 * Remove snapshots under `prefix` that are not in `validKeys`.
 * Used to evict data for programmes/tokens that no longer exist.
 */
export function pruneCache(prefix: string, validKeys: string[]): void {
  try {
    const keep = new Set(validKeys.map((k) => storageKey(k)));
    Object.keys(localStorage)
      .filter((k) => k.startsWith(storageKey(prefix)) && !keep.has(k))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}

/** Wipe every cached snapshot (used on wallet disconnect / hard logout). */
export function clearAllCaches(): void {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(PREFIX))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}
