---
name: API Proxy Domain
description: api.loyalspark.online — только Edge/API (REST, MCP, x402). loyalspark.online — публичный сайт и discovery-файлы. PUBLIC_BASE_URL = api host only.
type: integration
---
# API proxy: api.loyalspark.online

## Два хоста (не смешивать)

| Хост | Назначение | Примеры |
|------|------------|---------|
| **`https://loyalspark.online`** | Публичный сайт (Lovable/Vite), маркетинг, порталы, статика, discovery-файлы | `/`, `/for-agents`, `/merchant`, `/.well-known/agent.json`, `/openapi.json`, `/llms.txt`, логотипы |
| **`https://api.loyalspark.online`** | Замена `https://bzxmejzssxjazswgwqqs.supabase.co/functions/v1` — только runtime API | `/agent-api/*`, `/loyalty-mcp`, `/recipient-api/*`, `/x402-gateway/*`, `/mpp-gateway/*`, `/.well-known/x402` |

**`PUBLIC_BASE_URL=https://api.loyalspark.online`** — env **только для Edge Functions**, чтобы x402 `resource` URL, Bazaar discovery и paid REST/MCP ссылки указывали на API-прокси, а **не** на `supabase.co` и **не** на `loyalspark.online`.

- В x402 metadata поля `website`, `documentation`, `logo` → **`https://loyalspark.online`** (бренд).
- Поля `resource`, gateway base, SIWE/register URLs → **`https://api.loyalspark.online`** (или `PUBLIC_BASE_URL`).

**Никогда** не ставить `PUBLIC_BASE_URL=https://loyalspark.online` — сайт не проксирует Edge Functions.

Cloudflare Worker `loyalspark-api-proxy` (gerassyk.workers.dev) проксирует все запросы с `https://api.loyalspark.online/*` на `https://bzxmejzssxjazswgwqqs.supabase.co/functions/v1/*`.

## Что сохраняется
- Все заголовки кроме CF-internal (`cf-*`, `host`, `x-forwarded-*`)
- Тело запроса для POST/PUT/PATCH/DELETE
- Статусы (включая 402 для x402-flow)
- Хедеры `payment-required`, `x-payment-required`, `x-payment-response`, CORS
- Добавляется `x-proxied-by: loyalspark-cf-worker`

## Health-check
`GET https://api.loyalspark.online/health` → `{"ok":true,"service":"loyalspark-api-proxy",...}`

## Где какой хост

**`loyalspark.online`** — discovery и человекочитаемые ссылки в `public/`:
- `agent.json` → `"url": "https://loyalspark.online"`; skills/docs paths на этом же хосте
- `openapi.json`, `llms.txt`, логотипы, `/for-agents`, `/merchant`
- `/.well-known/x402.json` — **статический mirror** каталога paid resources (те же URL на `api.loyalspark.online`)

**`api.loyalspark.online`** — runtime вызовы в `agent.json`, skills, examples, боте:
- `"api.base_url"`, `x402-gateway`, `mpp-gateway`, `loyalty-mcp`, `agent-register-siwe`, `/.well-known/x402` (live Bazaar + discovery **origin** для x402scan)

**`openapi.json`:** файл лежит на `loyalspark.online/openapi.json`, но `servers[]` содержит **только** `https://api.loyalspark.online`, а `info.x-x402-discovery.wellKnownResources` → `https://api.loyalspark.online/.well-known/x402`. Второй server на `supabase.co` и `directGatewayBaseUrl` убраны (cc248cb), чтобы x402scan не индексировал два origin.

## PUBLIC_BASE_URL (Supabase secret)

Только для генерации **API resource URL** в Edge (`x402-bazaar-accept.ts`, `well-known-x402`):

```
PUBLIC_BASE_URL=https://api.loyalspark.online
```

Без этого x402scan регистрирует сервер как `bzxmejzssxjazswgwqqs.supabase.co`. С секретом — как `api.loyalspark.online`.

Не использовать для `website` / `documentation` в Bazaar metadata — там всегда `loyalspark.online`.

## Worker code
Хранится в Cloudflare dashboard, не в репо. Файл: см. сообщения в чате (proxy с STRIP_REQUEST_HEADERS / STRIP_RESPONSE_HEADERS).
