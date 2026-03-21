# Agent-to-Agent (A2A) Loyalty Protocol — План интеграции

## Концепция: Dual-Mode Platform (Люди + AI-агенты)

Приложение остаётся единой платформой, где **люди** взаимодействуют через UI (SIWE + кошелёк),
а **AI-агенты** — через API/MCP. Общая база данных, общие смарт-контракты, общие токены.

```
┌─────────────────────────────────────────────────┐
│              Loyal Spark Platform                │
│                                                  │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐   │
│  │  Web UI   │    │ REST API │    │MCP Server│   │
│  │  (люди)   │    │ (агенты) │    │ (агенты) │   │
│  └─────┬─────┘    └─────┬────┘    └─────┬────┘   │
│        │                │               │        │
│        ▼                ▼               ▼        │
│  ┌──────────────────────────────────────────┐    │
│  │         Supabase (Edge Functions)         │    │
│  │    Auth · RLS · DB · Realtime             │    │
│  └─────────────────┬────────────────────────┘    │
│                    │                             │
│        ┌───────────┴───────────┐                 │
│        ▼                       ▼                 │
│  ┌──────────┐          ┌──────────────┐          │
│  │ Base L2  │          │ CDP Server   │          │
│  │ Contracts│          │ Wallet (MPC) │          │
│  └──────────┘          └──────────────┘          │
└─────────────────────────────────────────────────┘
```

---

## Фаза 1: Реестр агентов и API-ключи (БД + Edge Function)

### 1.1 Новые таблицы

```sql
-- Реестр AI-агентов
CREATE TABLE public.agent_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,                        -- "CoffeeBot Agent"
  owner_address text NOT NULL,               -- кошелёк владельца (мерчант или пользователь)
  agent_wallet_address text,                 -- CDP Server Wallet адрес агента
  api_key_hash text NOT NULL,                -- bcrypt хеш API-ключа
  api_key_prefix text NOT NULL,              -- первые 8 символов (для идентификации)
  scopes text[] DEFAULT '{read}',            -- права: read, create_program, mint, trade, manage_rewards
  is_active boolean DEFAULT true,
  rate_limit_per_minute int DEFAULT 60,
  total_requests bigint DEFAULT 0,
  last_request_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Лог действий агентов (аудит)
CREATE TABLE public.agent_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid REFERENCES agent_registry(id) ON DELETE CASCADE,
  action text NOT NULL,                      -- "create_program", "mint_tokens", "list_rewards"
  request_body jsonb,
  response_status int,
  ip_address text,
  created_at timestamptz DEFAULT now()
);

-- RLS: владелец видит своих агентов
ALTER TABLE agent_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage own agents" ON agent_registry
  FOR ALL TO authenticated
  USING (owner_address = (SELECT wallet_address FROM profiles WHERE user_id = auth.uid()))
  WITH CHECK (owner_address = (SELECT wallet_address FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Owners can view agent activity" ON agent_activity_log
  FOR SELECT TO authenticated
  USING (agent_id IN (
    SELECT id FROM agent_registry
    WHERE owner_address = (SELECT wallet_address FROM profiles WHERE user_id = auth.uid())
  ));
```

### 1.2 Edge Function: Генерация API-ключа

```
POST /functions/v1/agent-api-key
Headers: Authorization: Bearer <user_jwt>
Body: { "name": "My Agent", "scopes": ["read", "mint"] }
Response: { "api_key": "lsk_abc123...", "agent_id": "uuid" }
```

- Генерирует случайный ключ с префиксом `lsk_`
- Сохраняет bcrypt-хеш в `agent_registry`
- Ключ показывается один раз, потом только `api_key_prefix`

### 1.3 Middleware аутентификации агентов

```typescript
// В каждой agent-facing Edge Function:
async function authenticateAgent(req: Request): Promise<AgentContext> {
  const apiKey = req.headers.get('x-api-key');
  if (!apiKey || !apiKey.startsWith('lsk_')) throw new Error('Invalid API key');

  const prefix = apiKey.substring(0, 12);
  const { data: agent } = await supabase
    .from('agent_registry')
    .select('*')
    .eq('api_key_prefix', prefix)
    .eq('is_active', true)
    .single();

  if (!agent) throw new Error('Agent not found');

  // Verify bcrypt hash
  const valid = await bcrypt.compare(apiKey, agent.api_key_hash);
  if (!valid) throw new Error('Invalid API key');

  // Rate limiting
  if (agent.last_request_at) {
    // ... проверка лимитов
  }

  return { agentId: agent.id, scopes: agent.scopes, walletAddress: agent.agent_wallet_address };
}
```

---

## Фаза 2: REST API для агентов (Edge Functions)

### 2.1 Эндпоинты

| Метод | Путь | Scope | Описание |
|-------|------|-------|----------|
| GET | `/agent-api/programs` | `read` | Список всех активных программ лояльности |
| GET | `/agent-api/programs/:address` | `read` | Детали программы по token_address |
| POST | `/agent-api/programs` | `create_program` | Создать программу + deploy контракт |
| GET | `/agent-api/rewards` | `read` | Список наград для программы |
| POST | `/agent-api/rewards` | `manage_rewards` | Создать награду |
| POST | `/agent-api/mint` | `mint` | Минтить токены клиенту/агенту |
| GET | `/agent-api/balance` | `read` | Баланс токенов |
| POST | `/agent-api/marketplace/offer` | `trade` | Создать оффер на маркетплейсе |
| GET | `/agent-api/marketplace` | `read` | Список активных офферов |

### 2.2 Единая Edge Function с роутингом

```typescript
// supabase/functions/agent-api/index.ts
Deno.serve(async (req) => {
  // CORS
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  const path = url.pathname.replace('/agent-api', '');
  const agent = await authenticateAgent(req);

  // Роутинг
  switch (true) {
    case path === '/programs' && req.method === 'GET':
      return handleListPrograms(agent);
    case path === '/programs' && req.method === 'POST':
      requireScope(agent, 'create_program');
      return handleCreateProgram(agent, await req.json());
    case path === '/mint' && req.method === 'POST':
      requireScope(agent, 'mint');
      return handleMint(agent, await req.json());
    // ...
  }
});
```

### 2.3 Пример вызова агентом

```typescript
// Агент создаёт программу лояльности
const response = await fetch('https://<project>.supabase.co/functions/v1/agent-api/programs', {
  method: 'POST',
  headers: {
    'x-api-key': 'lsk_abc123...',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    name: 'AI Coffee Rewards',
    symbol: 'AICOF',
    expiration_days: 365,
  }),
});
```

---

## Фаза 3: MCP Server (для LLM-агентов)

### 3.1 MCP Server как Edge Function

Используем библиотеку `mcp-lite` для создания MCP-сервера:

```typescript
// supabase/functions/loyalty-mcp/index.ts
import { Hono } from "hono";
import { McpServer, StreamableHttpTransport } from "mcp-lite";

const mcpServer = new McpServer({
  name: "loyal-spark-mcp",
  version: "1.0.0",
});

// Tool: Список программ лояльности
mcpServer.tool({
  name: "list_loyalty_programs",
  description: "List all active loyalty programs on the platform",
  inputSchema: {
    type: "object",
    properties: {
      status: { type: "string", enum: ["active", "all"], default: "active" },
    },
  },
  handler: async ({ status }) => {
    const { data } = await supabase
      .from('loyalty_programs')
      .select('*')
      .eq('status', status === 'all' ? undefined : 'active');
    return { content: [{ type: "text", text: JSON.stringify(data) }] };
  },
});

// Tool: Создать программу
mcpServer.tool({
  name: "create_loyalty_program",
  description: "Deploy a new loyalty token program on Base L2",
  inputSchema: {
    type: "object",
    properties: {
      name: { type: "string", description: "Program name, e.g. 'Coffee Rewards'" },
      symbol: { type: "string", description: "Token symbol, e.g. 'COFFEE'" },
      expiration_days: { type: "number", description: "Days until program expires" },
    },
    required: ["name", "symbol", "expiration_days"],
  },
  handler: async ({ name, symbol, expiration_days }) => {
    // 1. Используем CDP Server Wallet для deploy
    // 2. Сохраняем в loyalty_programs
    // 3. Возвращаем token_address
  },
});

// Tool: Минтить токены
mcpServer.tool({
  name: "mint_loyalty_tokens",
  description: "Mint loyalty tokens to a customer or agent wallet",
  inputSchema: {
    type: "object",
    properties: {
      token_address: { type: "string" },
      recipient: { type: "string", description: "Wallet address of recipient" },
      amount: { type: "number", description: "Number of tokens to mint" },
    },
    required: ["token_address", "recipient", "amount"],
  },
  handler: async ({ token_address, recipient, amount }) => {
    // CDP Server Wallet подписывает транзакцию минта
  },
});

// Tool: Список наград
mcpServer.tool({
  name: "list_rewards",
  description: "List available rewards for a loyalty program",
  inputSchema: {
    type: "object",
    properties: {
      token_address: { type: "string" },
    },
    required: ["token_address"],
  },
  handler: async ({ token_address }) => {
    const { data } = await supabase
      .from('rewards')
      .select('*')
      .eq('token_address', token_address)
      .eq('is_active', true);
    return { content: [{ type: "text", text: JSON.stringify(data) }] };
  },
});

// Resource: информация о платформе
mcpServer.resource({
  uri: "loyalty://platform-info",
  name: "Platform Information",
  description: "General information about Loyal Spark platform",
  handler: async () => ({
    contents: [{
      uri: "loyalty://platform-info",
      mimeType: "application/json",
      text: JSON.stringify({
        name: "Loyal Spark",
        chain: "Base L2",
        token_standard: "ERC-20",
        features: ["loyalty_programs", "rewards", "marketplace", "tiers", "referrals"],
      }),
    }],
  }),
});
```

### 3.2 Подключение агента к MCP

```json
// В конфиге AI-агента (Claude, GPT и т.д.)
{
  "mcpServers": {
    "loyal-spark": {
      "url": "https://<project>.supabase.co/functions/v1/loyalty-mcp",
      "headers": {
        "x-api-key": "lsk_abc123..."
      }
    }
  }
}
```

---

## Фаза 4: CDP Server Wallet для агентов

### 4.1 Зачем нужен CDP

Когда агент создаёт программу или минтит токены, нужна подпись транзакции.
CDP Server Wallet решает это:
- Приватный ключ **никогда** не покидает secure enclave Coinbase
- Агент вызывает API → CDP подписывает → транзакция отправляется в Base

### 4.2 Интеграция

```typescript
// В Edge Function
import { CdpClient } from '@coinbase/cdp-sdk';

const cdp = new CdpClient({
  apiKeyId: Deno.env.get('CDP_API_KEY_ID'),
  apiKeySecret: Deno.env.get('CDP_API_KEY_SECRET'),
});

// Создать кошелёк для нового агента
async function createAgentWallet(agentId: string) {
  const account = await cdp.evm.createAccount({ name: `agent-${agentId}` });
  
  // Сохраняем адрес в agent_registry
  await supabase
    .from('agent_registry')
    .update({ agent_wallet_address: account.address })
    .eq('id', agentId);

  return account.address;
}

// Подписать транзакцию минта от имени агента
async function agentMint(agentWallet: string, tokenAddress: string, to: string, amount: bigint) {
  const txHash = await cdp.evm.sendTransaction({
    address: agentWallet,
    transaction: {
      to: tokenAddress,
      data: encodeFunctionData({
        abi: loyaltyTokenAbi,
        functionName: 'mint',
        args: [to, amount],
      }),
    },
    network: 'base',
  });
  
  return txHash;
}
```

### 4.3 Необходимые секреты

| Секрет | Источник |
|--------|---------|
| `CDP_API_KEY_ID` | Coinbase Developer Platform → API Keys |
| `CDP_API_KEY_SECRET` | Coinbase Developer Platform → API Keys |

---

## Фаза 5: UI для управления агентами (в существующем приложении)

### 5.1 Новая вкладка в MerchantPage

```
Merchant Panel
├── Programs (существующее)
├── Rewards (существующее)
├── CRM (существующее)
├── 🤖 AI Agents (НОВОЕ)
│   ├── Зарегистрировать агента
│   ├── Управление API-ключами
│   ├── Настройка scopes (права доступа)
│   ├── Лог активности агентов
│   └── Rate limits
```

### 5.2 Компоненты

- `src/components/agents/AgentRegistration.tsx` — форма регистрации агента
- `src/components/agents/AgentApiKeys.tsx` — управление ключами
- `src/components/agents/AgentActivityLog.tsx` — журнал действий
- `src/components/agents/AgentScopeSelector.tsx` — настройка прав

---

## Порядок реализации

### Этап 1 (MVP — 1-2 дня)
1. ✅ Создать таблицы `agent_registry` + `agent_activity_log`
2. ✅ Edge Function для генерации API-ключей
3. ✅ Edge Function `agent-api` с базовыми GET эндпоинтами (list programs, rewards)
4. ✅ UI: вкладка "AI Agents" в MerchantPage

### Этап 2 (Запись через API — 1-2 дня)
5. POST эндпоинты (create program, mint, create reward)
6. Интеграция с существующими смарт-контрактами через серверную подпись
7. Аудит-лог всех действий

### Этап 3 (MCP Server — 1 день)
8. MCP Server Edge Function с tools для всех операций
9. Тестирование с MCP Inspector
10. Документация для подключения агентов

### Этап 4 (CDP Wallets — 1-2 дня)
11. Интеграция CDP SDK
12. Автоматическое создание кошельков для агентов
13. Серверная подпись транзакций (mint, transfer, deploy)

### Этап 5 (Продвинутые фичи)
14. Agent-to-Agent обмен токенами через маркетплейс
15. Автоматические правила (automation rules) через API
16. Webhook уведомления для агентов
17. Discovery protocol (агент может найти подходящие программы)

---

## Совместимость: Люди + Агенты

| Функция | Люди (UI) | Агенты (API/MCP) |
|---------|-----------|------------------|
| Аутентификация | SIWE (подпись кошельком) | API-ключ (`x-api-key`) |
| Кошелёк | MetaMask / WalletConnect | CDP Server Wallet (MPC) |
| Создание программы | Форма в UI → tx через browser wallet | POST `/programs` → tx через CDP |
| Минт токенов | Форма → browser wallet подписывает | POST `/mint` → CDP подписывает |
| Просмотр данных | React компоненты | GET эндпоинты / MCP resources |
| Маркетплейс | UI карточки | POST `/marketplace/offer` |
| Данные | Общая БД Supabase, одни и те же таблицы |
| Контракты | Одни и те же смарт-контракты на Base |
| Токены | Одни и те же ERC-20 токены |

**Ключевой принцип**: API-слой — это «обёртка» над теми же операциями, что делает UI.
Нет дублирования бизнес-логики, только новый транспортный слой.
