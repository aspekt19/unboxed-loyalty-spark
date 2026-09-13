# loyalspark-api-proxy

Cloudflare Worker that fronts **`https://api.loyalspark.online`** → Supabase Edge Functions.

## Why this file exists in-repo

The live Worker historically lived only in the Cloudflare dashboard. Coppice’s public x402 check (2026-09-13) found that **plain HTTP** still returned a full **402 Payment Required** body while `resource.url` claimed `https://…`. Spec hygiene: cleartext must **308** to HTTPS, not answer the payment envelope.

## Deploy

1. Cloudflare Dashboard → Workers & Pages → `loyalspark-api-proxy` → Edit code → paste `worker.js` → Save & Deploy  
   **or** `npx wrangler deploy` from this folder (authenticated Wrangler).
2. Confirm Custom Domain: `api.loyalspark.online` still points at this Worker.
3. Optional zone setting: **SSL/TLS → Edge Certificates → Always Use HTTPS = On** (defense in depth; Worker 308 is still required if the Worker route runs on HTTP first).

## Verify (Coppice FAIL must become PASS)

```bash
# Must be 308 with Location: https://api.loyalspark.online/x402-gateway/programs
curl -sS -D - -o /dev/null --max-redirs 0 \
  "http://api.loyalspark.online/x402-gateway/programs"

# HTTPS still 402 with payment envelope
curl -sS -o /dev/null -w "%{http_code}\n" \
  "https://api.loyalspark.online/x402-gateway/programs"
```

See also: `.lovable/memory/integrations/api-proxy-domain.md`.
