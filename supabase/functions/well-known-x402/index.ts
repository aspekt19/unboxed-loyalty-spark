/**
 * x402 Discovery endpoint hosted on the same origin as the gateway.
 *
 * x402scan и аналогичные сканеры по DISCOVERY.md привязывают ресурсы из `resources[]`
 * к origin discovery-документа. У нас x402-gateway живёт на bzxmejzssxjazswgwqqs.supabase.co,
 * а статический /.well-known/x402.json раздаётся с loyalspark.online — поэтому регистрация
 * через сайт ломалась (сканер пытался дёргать loyalspark.online/functions/v1/...).
 *
 * Эта функция отдаёт тот же JSON, но с правильного origin (Supabase). Источник правды —
 * /.well-known/x402.json на сайте; здесь мы его проксируем + кэшируем на 5 минут.
 */

const CANONICAL_URL = "https://loyalspark.online/.well-known/x402.json";
const CACHE_TTL_MS = 5 * 60 * 1000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

let cache: { body: string; etag: string | null; fetchedAt: number } | null = null;

async function loadDiscovery(): Promise<{ body: string; etag: string | null }> {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return { body: cache.body, etag: cache.etag };
  }

  const upstream = await fetch(CANONICAL_URL, {
    headers: { Accept: "application/json" },
  });

  if (!upstream.ok) {
    throw new Error(`Upstream ${upstream.status}: failed to fetch ${CANONICAL_URL}`);
  }

  const body = await upstream.text();
  // Sanity check — must be valid JSON with `resources` array.
  const parsed = JSON.parse(body);
  if (!parsed || !Array.isArray(parsed.resources)) {
    throw new Error("Upstream payload is not a valid x402 discovery document");
  }

  cache = {
    body,
    etag: upstream.headers.get("etag"),
    fetchedAt: now,
  };
  return { body, etag: cache.etag };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json", Allow: "GET, HEAD, OPTIONS" },
    });
  }

  try {
    const { body, etag } = await loadDiscovery();

    const headers = new Headers(corsHeaders);
    headers.set("Content-Type", "application/json; charset=utf-8");
    headers.set("Cache-Control", "public, max-age=300");
    if (etag) headers.set("ETag", etag);

    if (req.method === "HEAD") {
      return new Response(null, { status: 200, headers });
    }

    return new Response(body, { status: 200, headers });
  } catch (err) {
    console.error("well-known-x402 error:", err);
    return new Response(
      JSON.stringify({
        error: "Failed to load x402 discovery document",
        message: err instanceof Error ? err.message : String(err),
        canonical: CANONICAL_URL,
      }),
      {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
