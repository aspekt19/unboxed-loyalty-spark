/**
 * loyalspark-api-proxy — Cloudflare Worker for api.loyalspark.online
 *
 * Proxies to: https://bzxmejzssxjazswgwqqs.supabase.co/functions/v1/*
 *
 * Coppice x402 FAIL (2026-09-13): plain HTTP was answering the full 402 payment
 * envelope while resource.url claimed https. Fix: 308 Permanent Redirect to HTTPS
 * before any Edge Function runs. Do not serve x402 / MPP / MCP over cleartext.
 *
 * Deploy: Cloudflare Dashboard → Workers → loyalspark-api-proxy → paste this file,
 * or `npx wrangler deploy` from this folder (see wrangler.toml).
 */

const ORIGIN = "https://bzxmejzssxjazswgwqqs.supabase.co/functions/v1";

/** Request headers that must not be forwarded to Supabase. */
const STRIP_REQUEST_HEADERS = new Set([
  "cf-connecting-ip",
  "cf-ipcountry",
  "cf-ray",
  "cf-visitor",
  "cf-worker",
  "host",
  // Rebuild x-forwarded-proto ourselves from the client URL (see below).
  "x-forwarded-proto",
  "x-forwarded-for",
  "x-forwarded-host",
]);

/** Response headers that confuse clients when echoed from Supabase. */
const STRIP_RESPONSE_HEADERS = new Set([
  "transfer-encoding",
  "connection",
  "keep-alive",
]);

export default {
  async fetch(request, _env, _ctx) {
    const url = new URL(request.url);

    // Coppice / x402 hygiene: never emit Payment-Required over cleartext HTTP.
    if (url.protocol === "http:") {
      url.protocol = "https:";
      return new Response(null, {
        status: 308,
        headers: {
          Location: url.toString(),
          "Cache-Control": "no-store",
        },
      });
    }

    // Health for the proxy itself (not Supabase).
    if (url.pathname === "/health" || url.pathname === "/health/") {
      return Response.json({
        ok: true,
        service: "loyalspark-api-proxy",
        origin: ORIGIN,
      });
    }

    const path = url.pathname.replace(/^\/+/, "");
    const target = `${ORIGIN}/${path}${url.search}`;

    const headers = new Headers();
    for (const [key, value] of request.headers) {
      if (STRIP_REQUEST_HEADERS.has(key.toLowerCase())) continue;
      headers.set(key, value);
    }
    // Tell Edge Functions the client-facing scheme (https after redirect above).
    headers.set("x-forwarded-proto", "https");
    headers.set("x-forwarded-host", url.host);

    const init = {
      method: request.method,
      headers,
      redirect: "manual",
    };
    if (request.method !== "GET" && request.method !== "HEAD") {
      init.body = request.body;
      // Required for streaming request bodies in modern Workers runtimes.
      init.duplex = "half";
    }

    const upstream = await fetch(target, init);
    const outHeaders = new Headers();
    for (const [key, value] of upstream.headers) {
      if (STRIP_RESPONSE_HEADERS.has(key.toLowerCase())) continue;
      outHeaders.set(key, value);
    }
    outHeaders.set("x-proxied-by", "loyalspark-cf-worker");

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: outHeaders,
    });
  },
};
