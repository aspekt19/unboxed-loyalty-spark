---
name: API Proxy Domain
description: api.loyalspark.online → Cloudflare Worker → Supabase Edge Functions. Used as canonical host in all manifests.
type: integration
---
# API proxy: api.loyalspark.online

Cloudflare Worker `loyalspark-api-proxy` (gerassyk.workers.dev) проксирует все запросы с `https://api.loyalspark.online/*` на `https://bzxmejzssxjazswgwqqs.supabase.co/functions/v1/*`.

## Что сохраняется
- Все заголовки кроме CF-internal (`cf-*`, `host`, `x-forwarded-*`)
- Тело запроса для POST/PUT/PATCH/DELETE
- Статусы (включая 402 для x402-flow)
- Хедеры `payment-required`, `x-payment-required`, `x-payment-response`, CORS
- Добавляется `x-proxied-by: loyalspark-cf-worker`

## Health-check
`GET https://api.loyalspark.online/health` → `{"ok":true,"service":"loyalspark-api-proxy",...}`

## Где используется как canonical host
- `public/.well-known/agent.json` (REST/MCP base URLs, x402 gateway, mpp gateway)
- `public/.well-known/mpp.json`, `farcaster.json`
- `public/openapi.json` (servers)
- `public/.well-known/skills/*.md`
- `public/llms.txt`, `public/llms-full.txt`
- `docs/agents/*`, `docs/integrations/*`
- `examples/agent-mcp/*`, `examples/recipient-agent-mcp/*`
- `scripts/x402-paid-*`, `scripts/agent-register-siwe/`

## Замечание о x402
Edge-функции внутри `payment-required` payload (base64) указывают `resource: https://bzxmejz...supabase.co/...`. Это не ломает оплату — x402-клиенты ходят по URL, по которому пришёл 402. Чтобы привести к канон. виду, можно прокинуть переменную окружения в edge-функции (`PUBLIC_BASE_URL=https://api.loyalspark.online`).

## Worker code
Хранится в Cloudflare dashboard, не в репо. Файл: см. сообщения в чате (proxy с STRIP_REQUEST_HEADERS / STRIP_RESPONSE_HEADERS).
