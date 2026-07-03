// Bazaar MCP side-car — lets Loyal Spark agents discover third-party x402
// resources & MCP servers published in Coinbase CDP's Bazaar registry.
//
// Docs: https://docs.cdp.coinbase.com/x402/bazaar
// Endpoints:
//   GET https://api.cdp.coinbase.com/platform/v2/x402/discovery/resources
//   GET https://api.cdp.coinbase.com/platform/v2/x402/discovery/mcp
//
// Both endpoints are public GETs. We cache in-memory for 60s so tool calls
// don't hammer CDP. Callers should still validate the returned URLs before
// letting an agent transact against them.

const BAZAAR_BASE = "https://api.cdp.coinbase.com/platform/v2/x402/discovery";
const CACHE_TTL_MS = 60_000;

type CacheEntry = { at: number; body: unknown };
const cache = new Map<string, CacheEntry>();

async function fetchJson(path: string, query: Record<string, string | number | undefined>) {
  const url = new URL(`${BAZAAR_BASE}${path}`);
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }
  const key = url.toString();
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.body;

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`bazaar_discovery_failed:${res.status}:${text.slice(0, 200)}`);
  }
  let body: unknown;
  try { body = JSON.parse(text); } catch { body = { raw: text }; }
  cache.set(key, { at: Date.now(), body });
  return body;
}

export interface DiscoverOpts {
  q?: string;          // free-text filter applied client-side on name/description
  network?: string;    // e.g. "base", "base-sepolia"
  limit?: number;      // client-side cap (default 25, max 100)
  cursor?: string;     // pass-through pagination cursor if the API supports it
}

function clientFilter(items: any[], opts: DiscoverOpts) {
  const q = (opts.q || "").trim().toLowerCase();
  const network = (opts.network || "").trim().toLowerCase();
  const limit = Math.max(1, Math.min(100, Number(opts.limit) || 25));
  let filtered = Array.isArray(items) ? items : [];
  if (q) {
    filtered = filtered.filter((it) => {
      const hay = JSON.stringify(it || {}).toLowerCase();
      return hay.includes(q);
    });
  }
  if (network) {
    filtered = filtered.filter((it) => {
      const nets = JSON.stringify(it?.accepts || it?.networks || it?.network || "").toLowerCase();
      return nets.includes(network);
    });
  }
  return filtered.slice(0, limit);
}

export async function discoverResources(opts: DiscoverOpts = {}) {
  const raw: any = await fetchJson("/resources", { cursor: opts.cursor });
  const items = raw?.items || raw?.resources || raw?.data || (Array.isArray(raw) ? raw : []);
  return {
    count: items.length,
    items: clientFilter(items, opts),
    next_cursor: raw?.next_cursor || raw?.cursor || null,
    source: "cdp.bazaar.resources",
  };
}

export async function discoverMcpServers(opts: DiscoverOpts = {}) {
  const raw: any = await fetchJson("/mcp", { cursor: opts.cursor });
  const items = raw?.items || raw?.servers || raw?.data || (Array.isArray(raw) ? raw : []);
  return {
    count: items.length,
    items: clientFilter(items, opts),
    next_cursor: raw?.next_cursor || raw?.cursor || null,
    source: "cdp.bazaar.mcp",
  };
}

// Probe a candidate x402 endpoint: does a bare GET, and if the server responds
// with HTTP 402 + JSON payment requirements, we return them so the calling
// agent can decide whether to pay. No signing happens here.
export async function probeX402Endpoint(targetUrl: string) {
  let u: URL;
  try { u = new URL(targetUrl); } catch { return { ok: false, error: "invalid_url" }; }
  if (u.protocol !== "https:") return { ok: false, error: "https_required" };

  const res = await fetch(u.toString(), { method: "GET", headers: { Accept: "application/json" } });
  const text = await res.text();
  let body: unknown;
  try { body = JSON.parse(text); } catch { body = { raw: text.slice(0, 500) }; }

  if (res.status === 402) {
    return { ok: true, status: 402, requires_payment: true, accepts: (body as any)?.accepts || body };
  }
  return { ok: true, status: res.status, requires_payment: false, body };
}
