# 🤖 Loyal Spark — OpenServ AI Team Setup

> 4 ИИ-агента для автономного роста проекта: CEO, SEO, Growth, Data Analyst.

## Важно про этот репозиторий

В **текущем** GitHub-репозитории (`aspekt19/unboxed-loyalty-spark`) **нет** каталога `agents/`, файла `setup-agents.sh` и `docker-compose.yml` из примеров ниже — это **референс-архитектура**, которую можно воспроизвести в отдельном репо или у себя локально. Для интеграции с Loyal Spark достаточно любого OpenServ-агента (один сервис), которому заданы:

- `LOYAL_SPARK_API` = `https://bzxmejzssxjazswgwqqs.supabase.co/functions/v1/agent-api` (или ваш кастомный деплой)
- `LOYAL_SPARK_API_KEY` = ключ `lsk_...` из [loyalspark.online/merchant](https://loyalspark.online/merchant) → вкладка **AI Agents**

Общая карта для агентов: [AGENTS.md](../../AGENTS.md).

## Быстрый старт (если поднимаешь стек как в документе)

```bash
# 1. Отдельная папка проекта (пример). Скрипты ниже — шаблон, не часть monorepo.
mkdir loyal-spark-agents && cd loyal-spark-agents
# Скопируй структуру из раздела «Архитектура» и добавь setup-agents.sh / docker-compose при необходимости.

# 2. Ключи в .env каждого сервиса-агента:
# OPENSERV_API_KEY — из OpenServ Secret Management
# LOYAL_SPARK_API_KEY — из панели мерчанта (вкладка AI Agents)

# 3. Локально (пример): docker compose -f agents/docker-compose.yml up

# 4. Проброс портов через ngrok — по одному URL на агента, затем регистрация в OpenServ → Agent Management → Add Agent
```

---

## Архитектура

```
loyal-spark-agents/
├── agents/
│   ├── ceo-agent/
│   │   ├── src/index.ts
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── Dockerfile
│   │   └── .env
│   ├── seo-agent/
│   │   └── ... (та же структура)
│   ├── growth-agent/
│   │   └── ...
│   └── data-agent/
│       └── ...
├── docker-compose.yml
├── setup-agents.sh
└── README.md
```

### Как агенты связаны с Loyal Spark

```
┌─────────────────────────────────────────┐
│           OpenServ Platform             │
│                                         │
│  CEO ──delegate──> SEO / Growth / Data  │
│   │                                     │
└───┼─────────────────────────────────────┘
    │ createTask()
    ▼
┌─────────────────────────────────────────┐
│        Loyal Spark Agent API            │
│  GET /programs, /analytics, /customers  │
│  Auth: x-api-key: lsk_YOUR_KEY         │
└─────────────────────────────────────────┘
```

---

## 1. CEO/Product Agent (`agents/ceo-agent/src/index.ts`)

```typescript
import { Agent, z } from "@openserv-labs/sdk";

const LOYAL_SPARK_API = process.env.LOYAL_SPARK_API_URL 
  || "https://bzxmejzssxjazswgwqqs.supabase.co/functions/v1/agent-api";
const API_KEY = process.env.LOYAL_SPARK_API_KEY || "";

async function callLoyalSparkAPI(endpoint: string) {
  const res = await fetch(`${LOYAL_SPARK_API}${endpoint}`, {
    headers: { "x-api-key": API_KEY, "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

const ceo = new Agent({
  systemPrompt: `Ты — CEO/Product Owner проекта Loyal Spark (unboxed-loyalty-spark).

Твоя роль:
- Координировать команду из 3 специалистов: SEO, Growth, Data Analyst
- Принимать стратегические решения на основе реальных метрик проекта
- Приоритезировать задачи по ROI и скорости запуска
- Формулировать user stories и PRD для новых фич

Проект: Onchain Loyalty Protocol на Base L2.
Сайт: https://loyalspark.online
API: 22 REST-эндпоинта + 17 MCP-инструментов
Монетизация: депозитная модель ($5 = 90 дней)

Правила:
- Всегда начинай с запроса актуальных метрик (get_project_metrics)
- Делегируй специализированные задачи соответствующим агентам
- Давай конкретные рекомендации, а не абстрактные советы
- Приоритеты: 1) Привлечение мерчантов 2) SEO/контент 3) Продуктовые фичи`,
  apiKey: process.env.OPENSERV_API_KEY!,
});

// Реальные метрики проекта через Agent API
ceo.addCapability({
  name: "get_project_metrics",
  description: "Получить актуальные метрики проекта: программы, токены, P2P-трейды",
  schema: z.object({
    token_address: z.string().optional().describe("Адрес конкретного токена для детальной аналитики"),
  }),
  async run({ args }) {
    try {
      const programs = await callLoyalSparkAPI("/programs");
      
      let analytics = null;
      if (args.token_address) {
        analytics = await callLoyalSparkAPI(`/analytics?token_address=${args.token_address}`);
      }

      return JSON.stringify({
        total_programs: programs.data?.length || 0,
        programs: programs.data?.map((p: any) => ({
          name: p.name,
          symbol: p.symbol,
          token_address: p.token_address,
          status: p.status,
        })),
        analytics: analytics?.data || null,
        timestamp: new Date().toISOString(),
      }, null, 2);
    } catch (error) {
      return `Ошибка получения метрик: ${error}. Убедись что LOYAL_SPARK_API_KEY настроен.`;
    }
  },
});

// Список программ лояльности
ceo.addCapability({
  name: "list_programs",
  description: "Получить список всех активных программ лояльности",
  schema: z.object({}),
  async run() {
    try {
      const data = await callLoyalSparkAPI("/programs");
      return JSON.stringify(data, null, 2);
    } catch (error) {
      return `Ошибка: ${error}`;
    }
  },
});

// P2P маркетплейс
ceo.addCapability({
  name: "get_marketplace",
  description: "Получить активные предложения на P2P-маркетплейсе",
  schema: z.object({}),
  async run() {
    try {
      const data = await callLoyalSparkAPI("/offers");
      return JSON.stringify(data, null, 2);
    } catch (error) {
      return `Ошибка: ${error}`;
    }
  },
});

// Стратегическая приоритезация
ceo.addCapability({
  name: "prioritize_tasks",
  description: "Приоритезировать задачи по матрице Impact/Effort на основе текущих метрик",
  schema: z.object({
    tasks: z.array(z.string()).describe("Список задач для приоритезации"),
    context: z.string().optional().describe("Дополнительный контекст: текущий фокус, дедлайны"),
  }),
  async run({ args }) {
    // Получаем метрики для контекста
    let metrics = "Метрики недоступны";
    try {
      const programs = await callLoyalSparkAPI("/programs");
      metrics = `Активных программ: ${programs.data?.length || 0}`;
    } catch (e) {
      // ignore
    }

    return `Приоритезация на основе данных:
Метрики: ${metrics}
Контекст: ${args.context || "не указан"}

Задачи для анализа:
${args.tasks.map((t, i) => `${i + 1}. ${t}`).join("\n")}

Критерии приоритезации:
- Impact на привлечение мерчантов (вес 40%)
- Скорость реализации (вес 30%)  
- Влияние на retention (вес 20%)
- Технический долг (вес 10%)

Рекомендую запросить детальный анализ у специализированных агентов через делегирование задач.`;
  },
});

export default ceo.handler();
```

---

## 2. SEO Agent (`agents/seo-agent/src/index.ts`)

```typescript
import { Agent, z } from "@openserv-labs/sdk";

const seo = new Agent({
  systemPrompt: `Ты — SEO-директор проекта Loyal Spark.

Твоя экспертиза:
- Технический SEO-аудит (meta, headers, JSON-LD, Core Web Vitals)
- Подбор ключевых слов для ниш: loyalty programs, customer retention, Web3 rewards, onchain loyalty
- Контент-стратегия и структура статей
- Конкурентный анализ

Сайт проекта: https://loyalspark.online
Целевая аудитория: SaaS-бизнесы, ритейл, Web3-проекты
Конкуренты: Smile.io, LoyaltyLion, Yotpo, UDS

Правила:
- Давай конкретные рекомендации с примерами
- Каждая рекомендация должна иметь приоритет (P0/P1/P2)
- Учитывай что сайт — SPA на React (рендеринг на клиенте)
- JSON-LD и meta-теги уже реализованы (usePageMeta hook)`,
  apiKey: process.env.OPENSERV_API_KEY!,
});

// Реальный аудит URL
seo.addCapability({
  name: "audit_url",
  description: "SEO-аудит URL: meta-теги, заголовки, Open Graph, robots.txt, JSON-LD",
  schema: z.object({
    url: z.string().url().describe("URL страницы для аудита"),
  }),
  async run({ args }) {
    try {
      const res = await fetch(args.url, {
        headers: { "User-Agent": "LoyalSparkSEOBot/1.0" },
      });
      const html = await res.text();

      // Парсинг meta-тегов
      const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
      const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["'](.*?)["']/i);
      const ogTitle = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["'](.*?)["']/i);
      const ogDesc = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["'](.*?)["']/i);
      const ogImage = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["'](.*?)["']/i);
      const canonical = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["'](.*?)["']/i);
      const h1Count = (html.match(/<h1[^>]*>/gi) || []).length;
      const h2Count = (html.match(/<h2[^>]*>/gi) || []).length;
      const jsonLd = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);

      const title = titleMatch?.[1] || "НЕ НАЙДЕН";
      const description = descMatch?.[1] || "НЕ НАЙДЕН";

      const issues: string[] = [];
      const recommendations: string[] = [];

      // Анализ
      if (!titleMatch) issues.push("❌ Title отсутствует");
      else if (title.length > 60) issues.push(`⚠️ Title слишком длинный: ${title.length} символов (макс 60)`);
      else recommendations.push(`✅ Title OK: "${title}" (${title.length} символов)`);

      if (!descMatch) issues.push("❌ Meta description отсутствует");
      else if (description.length > 160) issues.push(`⚠️ Description слишком длинная: ${description.length} символов`);
      else recommendations.push(`✅ Description OK (${description.length} символов)`);

      if (h1Count === 0) issues.push("❌ H1 отсутствует");
      else if (h1Count > 1) issues.push(`⚠️ Найдено ${h1Count} тегов H1 (должен быть 1)`);
      else recommendations.push("✅ Один H1 — корректно");

      if (!ogTitle) issues.push("⚠️ og:title отсутствует");
      if (!ogImage) issues.push("⚠️ og:image отсутствует");
      if (!canonical) issues.push("⚠️ Canonical URL отсутствует");
      if (!jsonLd || jsonLd.length === 0) issues.push("⚠️ JSON-LD разметка отсутствует");
      else recommendations.push(`✅ JSON-LD: ${jsonLd.length} блок(ов)`);

      recommendations.push(`📊 Заголовки: H1=${h1Count}, H2=${h2Count}`);

      return `SEO-аудит: ${args.url}
Статус: ${res.status}

📋 ПРОБЛЕМЫ (${issues.length}):
${issues.length > 0 ? issues.join("\n") : "Проблем не найдено!"}

✅ КОРРЕКТНО:
${recommendations.join("\n")}

📌 РЕКОМЕНДАЦИИ:
${issues.length > 0 ? "P0: Исправить критические проблемы (❌)\nP1: Устранить предупреждения (⚠️)\nP2: Расширить JSON-LD и добавить FAQ Schema" : "Страница хорошо оптимизирована. Рекомендую фокус на контент и ключевые слова."}`;
    } catch (error) {
      return `Ошибка аудита ${args.url}: ${error}`;
    }
  },
});

// Контент-план
seo.addCapability({
  name: "content_plan",
  description: "Создать SEO-контент-план: структура статьи с ключевыми словами и заголовками",
  schema: z.object({
    topic: z.string().describe("Тема или ключевое слово"),
    target_audience: z.string().optional().describe("Целевая аудитория: merchants, developers, agents"),
  }),
  async run({ args }) {
    return `Контент-план для: "${args.topic}"
Аудитория: ${args.target_audience || "merchants + developers"}

Запрос обработан. Агент сгенерирует структуру статьи с:
- H1 с основным ключевым словом
- 5-7 H2 подзаголовков с long-tail ключевыми
- Internal linking к /guide, /api-docs, /merchant
- CTA в каждом разделе
- FAQ-секция для featured snippets
- Meta title (<60 символов) и description (<160 символов)`;
  },
});

// Анализ ключевых слов
seo.addCapability({
  name: "keyword_research",
  description: "Подбор ключевых слов для конкретной темы в нише лояльности",
  schema: z.object({
    seed_keyword: z.string().describe("Базовое ключевое слово"),
    intent: z.enum(["informational", "commercial", "transactional"]).optional(),
  }),
  async run({ args }) {
    return `Исследование ключевых слов: "${args.seed_keyword}"
Intent: ${args.intent || "mixed"}

Агент проанализирует:
- Кластеры ключевых слов (head, body, long-tail)
- Конкурентность и объём поиска (оценка)
- Связанные темы для контент-кластера
- Рекомендации по страницам для таргетинга`;
  },
});

export default seo.handler();
```

---

## 3. Growth Agent (`agents/growth-agent/src/index.ts`)

```typescript
import { Agent, z } from "@openserv-labs/sdk";

const growth = new Agent({
  systemPrompt: `Ты — Growth-маркетолог Loyal Spark.

Твоя экспертиза:
- A/B-тесты для лендингов и воронок регистрации
- Контент для соцсетей (X/Twitter, Farcaster, Telegram)
- Email-drip кампании для onboarding мерчантов  
- Реферальные программы и партнёрства
- UTM-стратегии и аналитика (CTR, CAC, LTV)

Правила контента:
- Посты для X/Farcaster: до 250 символов
- НЕ используй длинные тире (—) и AI-стилистику
- Тон: профессиональный но дружелюбный, как стартап-фаундер
- Всегда добавляй конкретные метрики и цифры где возможно
- Ссылки на docs выноси в отдельный пост треда

Проект: Onchain Loyalty Protocol на Base
Сайт: https://loyalspark.online
USP: "Loyalty-as-a-Service для ИИ-агентов и бизнеса"`,
  apiKey: process.env.OPENSERV_API_KEY!,
});

// Генерация постов для соцсетей
growth.addCapability({
  name: "generate_social_posts",
  description: "Создать серию постов для X/Twitter или Farcaster",
  schema: z.object({
    topic: z.string().describe("Тема или повод для постов"),
    platform: z.enum(["twitter", "farcaster", "both"]).default("both"),
    count: z.number().min(1).max(10).default(3).describe("Количество постов"),
  }),
  async run({ args }) {
    return `Генерация ${args.count} постов для ${args.platform}
Тема: "${args.topic}"

Агент создаст посты по правилам:
- До 250 символов каждый
- Без AI-стилистики и длинных тире
- С хэштегами: #LoyaltySpark #Base #Web3Loyalty
- CTA в последнем посте треда
- Ссылки в отдельном посте`;
  },
});

// A/B тест идеи
growth.addCapability({
  name: "ab_test_ideas",
  description: "Предложить A/B-тесты для увеличения конверсии",
  schema: z.object({
    goal: z.string().describe("Цель: signup, activation, retention, referral"),
    current_metric: z.string().optional().describe("Текущее значение метрики"),
  }),
  async run({ args }) {
    return `A/B-тесты для цели: "${args.goal}"
Текущая метрика: ${args.current_metric || "не указана"}

Агент предложит 3-5 тестов с:
- Гипотеза (что и почему меняем)
- Вариант A vs B (конкретные изменения)
- Метрика успеха (что измеряем)
- Минимальный размер выборки
- Ожидаемый uplift`;
  },
});

// Email-drip кампания
growth.addCapability({
  name: "email_drip_sequence",
  description: "Создать email-цепочку для onboarding мерчантов",
  schema: z.object({
    segment: z.string().describe("Сегмент: new_merchant, trial_expired, inactive"),
    emails_count: z.number().min(3).max(7).default(5),
  }),
  async run({ args }) {
    return `Email-drip для сегмента: "${args.segment}"
Количество писем: ${args.emails_count}

Агент создаст цепочку с:
- Subject line (до 50 символов, A/B варианты)
- Preview text
- Тело письма (структура и ключевые блоки)
- CTA (одна кнопка на письмо)
- Интервалы отправки (дни между письмами)
- Условия выхода из цепочки`;
  },
});

// UTM стратегия
growth.addCapability({
  name: "utm_strategy",
  description: "Создать UTM-стратегию для маркетинговых кампаний",
  schema: z.object({
    campaign_name: z.string().describe("Название кампании"),
    channels: z.array(z.string()).describe("Каналы: twitter, farcaster, email, telegram, partner"),
  }),
  async run({ args }) {
    const utmLinks = args.channels.map(ch => 
      `https://loyalspark.online/?utm_source=${ch}&utm_medium=${ch === "email" ? "email" : "social"}&utm_campaign=${args.campaign_name.toLowerCase().replace(/\s+/g, "_")}`
    );

    return `UTM-стратегия для "${args.campaign_name}"

Ссылки:
${utmLinks.map((link, i) => `${args.channels[i]}: ${link}`).join("\n")}

Метрики для отслеживания:
- CTR по каналам
- Конверсия в регистрацию
- CAC по каналам
- LTV сегментов`;
  },
});

export default growth.handler();
```

---

## 4. Data Analyst Agent (`agents/data-agent/src/index.ts`)

```typescript
import { Agent, z } from "@openserv-labs/sdk";

const LOYAL_SPARK_API = process.env.LOYAL_SPARK_API_URL 
  || "https://bzxmejzssxjazswgwqqs.supabase.co/functions/v1/agent-api";
const API_KEY = process.env.LOYAL_SPARK_API_KEY || "";

async function callAPI(endpoint: string) {
  const res = await fetch(`${LOYAL_SPARK_API}${endpoint}`, {
    headers: { "x-api-key": API_KEY },
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

const dataAnalyst = new Agent({
  systemPrompt: `Ты — Data Analyst проекта Loyal Spark.

Твоя экспертиза:
- Анализ метрик: регистрации, конверсии, удержание, доходы
- SQL-запросы для исследования данных
- Когортный анализ и RFM-сегментация
- Обнаружение аномалий и трендов
- Визуализация данных (рекомендации по графикам)

База данных проекта включает таблицы:
- loyalty_programs (программы лояльности)
- token_mint_history (история минтов)
- vouchers (ваучеры/купоны)
- customer_profiles (профили клиентов)
- marketplace_offers (P2P-предложения)
- reviews (отзывы)

Правила:
- Всегда начинай с получения актуальных данных через API
- Давай выводы с конкретными числами
- Предлагай actionable рекомендации для CEO
- Форматируй отчёты в Markdown`,
  apiKey: process.env.OPENSERV_API_KEY!,
});

// Еженедельный отчёт
dataAnalyst.addCapability({
  name: "weekly_report",
  description: "Сгенерировать еженедельный отчёт по метрикам проекта",
  schema: z.object({
    token_address: z.string().optional().describe("Адрес токена для детального анализа"),
  }),
  async run({ args }) {
    try {
      const programs = await callAPI("/programs");
      const offers = await callAPI("/offers");
      
      let analytics = null;
      if (args.token_address) {
        analytics = await callAPI(`/analytics?token_address=${args.token_address}`);
      }

      const report = `# 📊 Еженедельный отчёт Loyal Spark
Дата: ${new Date().toISOString().split("T")[0]}

## Ключевые метрики

| Метрика | Значение |
|---------|----------|
| Активных программ | ${programs.data?.length || 0} |
| Предложений на маркетплейсе | ${offers.data?.length || 0} |
${analytics ? `| Клиентов | ${analytics.data?.total_customers || "N/A"} |
| Ваучеров выдано | ${analytics.data?.total_vouchers_issued || "N/A"} |` : ""}

## Программы лояльности
${programs.data?.map((p: any) => `- **${p.name}** (${p.symbol}) — статус: ${p.status}`).join("\n") || "Нет данных"}

## Рекомендации
На основе данных агент сформулирует:
1. Тренды роста/падения
2. Аномалии в метриках
3. Топ-3 action items для CEO`;

      return report;
    } catch (error) {
      return `Ошибка генерации отчёта: ${error}. Проверь LOYAL_SPARK_API_KEY.`;
    }
  },
});

// Генерация SQL-запросов
dataAnalyst.addCapability({
  name: "generate_sql",
  description: "Сгенерировать SQL-запрос для анализа конкретной метрики",
  schema: z.object({
    question: z.string().describe("Вопрос на естественном языке: 'сколько новых мерчантов за последний месяц?'"),
  }),
  async run({ args }) {
    return `SQL-запрос для: "${args.question}"

Агент сгенерирует:
- Оптимизированный SQL-запрос
- Объяснение логики
- Ожидаемая структура результата
- Рекомендации по визуализации

Доступные таблицы: loyalty_programs, token_mint_history, vouchers, customer_profiles, marketplace_offers, reviews, customer_tiers, referrals`;
  },
});

// Анализ аномалий
dataAnalyst.addCapability({
  name: "check_anomalies",
  description: "Проверить данные проекта на аномалии и необычные паттерны",
  schema: z.object({
    token_address: z.string().optional(),
  }),
  async run({ args }) {
    try {
      const programs = await callAPI("/programs");
      const offers = await callAPI("/offers");

      return `Проверка аномалий (${new Date().toISOString()}):

Данные получены:
- Программ: ${programs.data?.length || 0}
- Предложений: ${offers.data?.length || 0}

Агент проанализирует:
- Резкие изменения в количестве минтов
- Неактивные программы (последний минт > 7 дней)
- Подозрительные паттерны в P2P-трейдах
- Аномалии в балансах клиентов`;
    } catch (error) {
      return `Ошибка проверки: ${error}`;
    }
  },
});

export default dataAnalyst.handler();
```

---

## 5. Общие файлы

### `package.json` (одинаковый для каждого агента)

```json
{
  "name": "AGENT_NAME",
  "private": true,
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "start": "tsx src/index.ts"
  },
  "dependencies": {
    "@openserv-labs/sdk": "latest",
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "tsx": "^4.7.0",
    "typescript": "^5.3.3"
  }
}
```

### `tsconfig.json` (одинаковый для каждого агента)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "strict": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

### `Dockerfile` (одинаковый для каждого агента)

```dockerfile
FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE ${PORT:-7378}
CMD ["npm", "start"]
```

### `.env` (шаблон для каждого агента)

```env
OPENSERV_API_KEY=your_openserv_api_key_here
OPENSERV_SECRET_KEY=yuri-loyalty-spark-AGENT_NAME
LOYAL_SPARK_API_KEY=lsk_your_key_here
LOYAL_SPARK_API_URL=https://bzxmejzssxjazswgwqqs.supabase.co/functions/v1/agent-api
PORT=AGENT_PORT
```

---

## 6. Docker Compose (`agents/docker-compose.yml`)

```yaml
version: '3.8'
services:
  ceo-agent:
    build: ./ceo-agent
    ports:
      - "7378:7378"
    env_file: ./ceo-agent/.env
    restart: unless-stopped

  seo-agent:
    build: ./seo-agent
    ports:
      - "7379:7379"
    env_file: ./seo-agent/.env
    restart: unless-stopped

  growth-agent:
    build: ./growth-agent
    ports:
      - "7380:7380"
    env_file: ./growth-agent/.env
    restart: unless-stopped

  data-agent:
    build: ./data-agent
    ports:
      - "7381:7381"
    env_file: ./data-agent/.env
    restart: unless-stopped

networks:
  default:
    driver: bridge
```

---

## 7. Setup Script (`setup-agents.sh`)

```bash
#!/bin/bash
echo "🚀 Setting up Loyal Spark AI Team (4 agents)..."

cd $(dirname $0) || exit

AGENTS=("ceo-agent" "seo-agent" "growth-agent" "data-agent")
PORTS=(7378 7379 7380 7381)

mkdir -p agents

for i in "${!AGENTS[@]}"; do
  AGENT="${AGENTS[$i]}"
  PORT="${PORTS[$i]}"
  
  echo "📦 Setting up $AGENT (port $PORT)..."
  mkdir -p "agents/$AGENT/src"

  # package.json
  cat > "agents/$AGENT/package.json" << EOF
{
  "name": "$AGENT",
  "private": true,
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "start": "tsx src/index.ts"
  },
  "dependencies": {
    "@openserv-labs/sdk": "latest",
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "tsx": "^4.7.0",
    "typescript": "^5.3.3"
  }
}
EOF

  # tsconfig.json
  cat > "agents/$AGENT/tsconfig.json" << 'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "strict": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
EOF

  # Dockerfile
  cat > "agents/$AGENT/Dockerfile" << EOF
FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE $PORT
CMD ["npm", "start"]
EOF

  # .env
  cat > "agents/$AGENT/.env" << EOF
OPENSERV_API_KEY=REPLACE_WITH_YOUR_OPENSERV_KEY
OPENSERV_SECRET_KEY=yuri-loyalty-spark-$AGENT
LOYAL_SPARK_API_KEY=lsk_REPLACE_WITH_YOUR_KEY
LOYAL_SPARK_API_URL=https://bzxmejzssxjazswgwqqs.supabase.co/functions/v1/agent-api
PORT=$PORT
EOF

  # Install dependencies
  cd "agents/$AGENT" && npm install && cd ../..

  echo "✅ $AGENT готов (порт $PORT)"
done

echo ""
echo "🎉 Все 4 агента созданы!"
echo ""
echo "Следующие шаги:"
echo "1. Скопируй src/index.ts из docs/integrations/OPENSERV_AGENTS_SETUP.md в каждую папку агента"
echo "2. Замени OPENSERV_API_KEY и LOYAL_SPARK_API_KEY в .env файлах"
echo "3. Запусти: docker-compose -f agents/docker-compose.yml up"
echo "4. Пробрось через ngrok: ngrok http 7378 (и т.д.)"
echo "5. Зарегистрируй в OpenServ → Agent Management → Add Agent"
```

---

## 8. Регистрация в OpenServ

Для каждого агента:
1. **OpenServ Dashboard** → Agent Management → Add Agent
2. Заполни:
   - **Name**: `Loyal Spark CEO` / `Loyal Spark SEO` / `Loyal Spark Growth` / `Loyal Spark Data`
   - **Endpoint**: ngrok URL или Railway URL
3. Протестируй:
   - CEO: "Создай план роста Loyal Spark на май 2026"
   - SEO: "Сделай аудит https://loyalspark.online"
   - Growth: "Создай 3 поста для Twitter о запуске API для агентов"
   - Data: "Сгенерируй еженедельный отчёт по метрикам"

---

## 9. Продакшен-деплой (Railway)

```bash
# Каждый агент = отдельный Railway сервис
# В Railway Dashboard:
# 1. New Project → Deploy from GitHub
# 2. Root Directory: agents/ceo-agent
# 3. Environment Variables: скопируй из .env
# 4. Повтори для остальных агентов
```

---

## 10. 🔄 Developer Bridge — Обратная связь с Lovable

Все агенты могут отправлять отчёты и рекомендации разработчику (Lovable) через endpoint `agent-reports`.

### Как это работает

```
OpenServ Agents ──POST──> agent-reports (Edge Function) ──> agent_reports (DB)
                                                               │
User в Lovable: "Проверь что агенты нашли" ──> Lovable читает ──┘
                                                               │
Lovable реализует рекомендации ──> коммит в проект ────────────┘
```

### Capability `send_to_developer` (добавь в каждого агента)

```typescript
// Добавь в КАЖДОГО агента после остальных capabilities
const REPORTS_URL = process.env.LOYAL_SPARK_REPORTS_URL
  || "https://bzxmejzssxjazswgwqqs.supabase.co/functions/v1/agent-reports";

agent.addCapability({
  name: "send_to_developer",
  description: "Отправить отчёт или рекомендацию разработчику (Lovable) для реализации",
  schema: z.object({
    report_type: z.enum([
      "seo_audit",       // результат SEO-аудита
      "growth_idea",     // маркетинговая идея
      "data_report",     // аналитический отчёт
      "anomaly",         // обнаруженная аномалия
      "task",            // конкретная задача на разработку
      "recommendation",  // общая рекомендация
      "weekly_report",   // еженедельный отчёт
    ]),
    title: z.string().describe("Заголовок отчёта"),
    content: z.string().describe("Детальное содержание: что нашёл, что рекомендуешь"),
    priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
    action_items: z.array(z.string()).optional().describe("Конкретные задачи для разработчика"),
  }),
  async run({ args }) {
    try {
      const res = await fetch(REPORTS_URL, {
        method: "POST",
        headers: {
          "x-api-key": process.env.LOYAL_SPARK_API_KEY!,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          agent_role: "AGENT_ROLE_HERE", // замени на ceo/seo/growth/data
          report_type: args.report_type,
          title: args.title,
          content: args.content,
          priority: args.priority,
          action_items: args.action_items || [],
        }),
      });

      const data = await res.json();
      if (data.success) {
        return `✅ Отчёт "${args.title}" отправлен разработчику (ID: ${data.report_id}). Приоритет: ${args.priority}.`;
      }
      return `❌ Ошибка отправки: ${data.error}`;
    } catch (error) {
      return `❌ Не удалось отправить отчёт: ${error}`;
    }
  },
});
```

### API эндпоинты для agent-reports

| Метод | Описание | Авторизация |
|-------|----------|-------------|
| `POST /agent-reports` | Отправить отчёт | `x-api-key: lsk_*` |
| `GET /agent-reports?status=new&limit=20` | Прочитать отчёты | JWT или API key |
| `PATCH /agent-reports` | Обновить статус отчёта | JWT (authenticated) |

### Статусы отчётов

- `new` — только поступил, ждёт ревью
- `reviewed` — разработчик прочитал
- `in_progress` — разработчик работает над задачей
- `done` — реализовано
- `dismissed` — отклонено

### Пример использования в чате с Lovable

```
Ты: "Проверь что агенты нашли"
Lovable: читает GET /agent-reports?status=new → показывает список
Ты: "Реализуй рекомендацию #3 от SEO-агента"
Lovable: реализует → PATCH статус на done
```

### Добавь в .env каждого агента

```env
LOYAL_SPARK_REPORTS_URL=https://bzxmejzssxjazswgwqqs.supabase.co/functions/v1/agent-reports
```

---

## Дорожная карта

- [x] Фаза 1: CEO Agent с реальными метриками
- [x] Фаза 1.5: Developer Bridge (agent-reports)
- [ ] Фаза 2: SEO + Growth с аудитом и контентом
- [ ] Фаза 3: Data Analyst с еженедельными отчётами
- [ ] Фаза 4: Workflow CEO→SEO→Growth→Developer в OpenServ
- [ ] Фаза 5: Деплой на Railway + мониторинг
