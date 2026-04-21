# OpenServ (and other hosts) — MCP auth for Loyal Spark

> **Canonical MCP URL for agents:** `https://api.loyalspark.online/loyalty-mcp` (use this in catalogs and production configs). The `…supabase.co/functions/v1/loyalty-mcp` URL referenced below is the underlying Edge Function origin and is shown only for low-level diagnostics.

## Symptom

Tool calls return:

```json
{"error":"Not authenticated. Provide x-api-key header."}
```

(or the updated message mentioning `Authorization: Bearer`).

The MCP server is configured in the UI with **URL** + **Headers** `x-api-key: lsk_...`, but the **workflow agent** still fails.

## Why it happens

1. **Headers not on every HTTP request**  
   Some platforms store MCP credentials in the catalog but **do not attach** `x-api-key` to each JSON-RPC `POST` the runner sends to `.../functions/v1/loyalty-mcp`. The Edge function then sees no key.

2. **Only `Authorization` is forwarded**  
   Many HTTP clients send **`Authorization: Bearer <token>`** and omit custom headers. Until 2026-04, `loyalty-mcp` only read `x-api-key`. It now also accepts **`Authorization: Bearer lsk_...`** (and the same pattern for recipient MCP with `rwk_...`).

3. **Wrong Supabase project URL**  
   The URL must match your project ref, e.g. `https://<project-ref>.supabase.co/functions/v1/loyalty-mcp`. A typo still hits *some* HTTP server but usually not your keys.

4. **`get_platform_stats` after auth**  
   That tool requires an **admin-scoped** merchant key. A valid `lsk_` without admin scope returns a **scope** error, not “Not authenticated”. If you only see the auth message, the key never reached the function.

## What to do in OpenServ

1. **Secrets / workflow env**  
   Add `LOYAL_SPARK_API_KEY` = full `lsk_...` in OpenServ **Secrets** (or the workflow’s env block), then in the Analyst system prompt or tool policy instruct: pass the key on every MCP call.  
   If OpenServ has “attach MCP integration to this agent”, enable it so the runner injects headers.

2. **Put the key in `Authorization` instead of (or in addition to) `x-api-key`**  
   In the MCP server headers UI, try:
   - **Key:** `Authorization`  
   - **Value:** `Bearer lsk_your_actual_key`  

   Redeploy / save, then re-run the workflow.

3. **Re-copy the key from the merchant UI**  
   `/merchant` → **AI Agents** → rotate or create a key if unsure. Keys are shown once at creation.

4. **Smoke test with curl** (must return JSON, not auth error):

```bash
export LSK='lsk_...'
curl -sS -X POST "$URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LSK" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_my_profile","arguments":{}}}'
```

Use your real `loyalty-mcp` URL for `$URL`. If you use `x-api-key` instead of `Authorization`, add `-H "x-api-key: $LSK"`.

## Repo behaviour (after fix)

- `supabase/functions/loyalty-mcp/index.ts` resolves the merchant key via `resolveMcpApiKey` (`_shared/mcp-http-api-key.ts`): **`x-api-key`** or **`Authorization: Bearer`** with prefix `lsk_`.
- `recipient-loyalty-mcp` does the same for `rwk_`.

Deploy Edge Functions after pulling these changes (`supabase functions deploy loyalty-mcp` or your CI).

## Related

- [PORTALS_AND_TEAM.md](../development/PORTALS_AND_TEAM.md) — merchant UI for API keys  
- [examples/agent-mcp/](../../examples/agent-mcp/) — Cursor MCP with `headers.x-api-key`
