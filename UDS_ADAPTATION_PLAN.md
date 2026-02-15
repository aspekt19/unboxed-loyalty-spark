# План адаптации UDS App для Loyal Spark

## Анализ UDS App

### Обзор платформы
UDS App - ведущая система лояльности в России/СНГ с более чем 76,000+ клиентов на одного мерчанта. Единое приложение объединяет клиентов и бизнес.

### Ключевые результаты UDS
- **3x** рост повторных покупок
- **23%** увеличение прибыли
- **∞** лояльность клиентов

---

## Функционал UDS для адаптации

### 1. Управление клиентами (CRM)
**UDS имеет:**
- База клиентов с детальными профилями
- Фильтры и сегментация
- RFM анализ (Recency, Frequency, Monetary)
- Статистика по клиентам
- История покупок

**Адаптация для Loyal Spark:**
```typescript
// Новая таблица для расширенных профилей клиентов
CREATE TABLE customer_profiles (
  id UUID PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  email TEXT,
  total_purchases NUMERIC DEFAULT 0,
  total_spent NUMERIC DEFAULT 0,
  last_purchase_date TIMESTAMP,
  rfm_score TEXT, // 'champions', 'loyal', 'at_risk', 'lost'
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Web3 преимущество:** 
- Все транзакции верифицируются через blockchain
- Невозможно подделать историю покупок
- Клиент владеет своими данными

---

### 2. Программа лояльности с уровнями
**UDS имеет:**
- Накопительная система баллов
- Приветственные бонусы
- Кэшбек с каждой покупки
- Сертификаты и подарки

**Адаптация для Loyal Spark:**
```typescript
// Таблица уровней клиентов
CREATE TABLE customer_tiers (
  id UUID PRIMARY KEY,
  program_token_address TEXT NOT NULL,
  tier_name TEXT NOT NULL, // 'Bronze', 'Silver', 'Gold', 'Platinum'
  min_tokens NUMERIC NOT NULL,
  cashback_multiplier NUMERIC DEFAULT 1.0, // 1.0x, 1.5x, 2.0x
  welcome_bonus NUMERIC DEFAULT 0,
  perks JSONB, // Дополнительные преимущества
  created_at TIMESTAMP DEFAULT NOW()
);

// Таблица для отслеживания уровня клиента
CREATE TABLE customer_tier_status (
  id UUID PRIMARY KEY,
  customer_address TEXT NOT NULL,
  token_address TEXT NOT NULL,
  current_tier_id UUID REFERENCES customer_tiers(id),
  tokens_earned_total NUMERIC DEFAULT 0,
  tier_achieved_at TIMESTAMP,
  UNIQUE(customer_address, token_address)
);
```

**Web3 преимущество:**
- Токены можно обменять/продать на DEX
- Прозрачная система начисления
- Автоматическое начисление через смарт-контракты

---

### 3. Push-уведомления и маркетинг
**UDS имеет:**
- Массовые push-уведомления
- Персонализированные акции
- Сегментированные рассылки
- Автоматические триггеры

**Адаптация для Loyal Spark:**
```typescript
// Таблица для маркетинговых кампаний
CREATE TABLE marketing_campaigns (
  id UUID PRIMARY KEY,
  merchant_address TEXT NOT NULL,
  token_address TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  target_segment TEXT, // 'all', 'champions', 'at_risk', 'inactive'
  min_balance NUMERIC,
  max_balance NUMERIC,
  scheduled_at TIMESTAMP,
  sent_at TIMESTAMP,
  status TEXT DEFAULT 'draft' // 'draft', 'scheduled', 'sent'
);

// Таблица для отслеживания уведомлений
CREATE TABLE notification_history (
  id UUID PRIMARY KEY,
  campaign_id UUID REFERENCES marketing_campaigns(id),
  customer_address TEXT NOT NULL,
  delivered_at TIMESTAMP,
  opened_at TIMESTAMP,
  clicked BOOLEAN DEFAULT FALSE
);
```

**Web3 преимущество:**
- Уведомления через Web3 кошельки (WalletConnect notifications)
- Onchain доказательство отправки промо

---

### 4. Аналитика и отчеты для мерчантов
**UDS имеет:**
- Дашборд с ключевыми метриками
- Графики продаж и активности
- Конверсия клиентов
- ROI программы лояльности
- Экспорт данных

**Адаптация для Loyal Spark:**
```typescript
// View для аналитики мерчанта
CREATE VIEW merchant_analytics AS
SELECT 
  lp.merchant_address,
  lp.token_address,
  lp.name as program_name,
  COUNT(DISTINCT v.customer_address) as total_customers,
  COUNT(DISTINCT CASE WHEN v.activated_at > NOW() - INTERVAL '30 days' THEN v.customer_address END) as active_customers_30d,
  COUNT(v.id) as total_vouchers_issued,
  COUNT(CASE WHEN v.status = 'used' THEN 1 END) as vouchers_redeemed,
  SUM(v.cost) as total_tokens_spent,
  AVG(v.cost) as avg_voucher_cost
FROM loyalty_programs lp
LEFT JOIN vouchers v ON v.token_address = lp.token_address
GROUP BY lp.merchant_address, lp.token_address, lp.name;
```

**Компоненты для дашборда:**
- График активных клиентов (день/неделя/месяц)
- Конверсия: новые клиенты → повторные покупки
- Top-10 самых активных клиентов
- Стоимость привлечения vs lifetime value
- Распределение клиентов по уровням

**Web3 преимущество:**
- Все данные верифицированы через blockchain
- Невозможно подделать статистику
- Прозрачная аналитика для всех участников

---

### 5. Источники трафика и реферальная программа
**UDS имеет:**
- Отслеживание источников клиентов
- Реферальные ссылки
- Награды за приглашение друзей
- Cross-маркетинг между компаниями

**Адаптация для Loyal Spark:**
```typescript
// Таблица реферальной программы
CREATE TABLE referral_program (
  id UUID PRIMARY KEY,
  token_address TEXT NOT NULL,
  referrer_bonus NUMERIC DEFAULT 0, // Бонус приглашающему
  referee_bonus NUMERIC DEFAULT 0, // Бонус новому клиенту
  is_active BOOLEAN DEFAULT TRUE
);

// Таблица рефералов
CREATE TABLE referrals (
  id UUID PRIMARY KEY,
  token_address TEXT NOT NULL,
  referrer_address TEXT NOT NULL,
  referee_address TEXT NOT NULL,
  referral_code TEXT UNIQUE NOT NULL,
  bonus_claimed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  claimed_at TIMESTAMP
);

// Источники трафика
CREATE TABLE traffic_sources (
  id UUID PRIMARY KEY,
  customer_address TEXT NOT NULL,
  token_address TEXT NOT NULL,
  source TEXT NOT NULL, // 'organic', 'referral', 'social', 'qr_code', 'web'
  referral_code TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(customer_address, token_address)
);
```

**Web3 преимущество:**
- Автоматическое начисление реферальных бонусов через смарт-контракты
- Невозможно обмануть систему рефералов
- Прозрачная история всех рефералов

---

### 6. Отзывы и рейтинги
**UDS имеет:**
- Система оценок 1-5 звезд
- Текстовые отзывы
- Модерация отзывов
- Публичный рейтинг компаний

**Адаптация для Loyal Spark:**
```typescript
// Таблица отзывов
CREATE TABLE reviews (
  id UUID PRIMARY KEY,
  token_address TEXT NOT NULL,
  customer_address TEXT NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  voucher_id UUID REFERENCES vouchers(id), // Привязка к конкретной покупке
  is_verified BOOLEAN DEFAULT FALSE, // Проверка, что была покупка
  merchant_response TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Web3 преимущество:**
- Отзывы привязаны к реальным onchain транзакциям
- Невозможно накрутить фейковые отзывы
- Верифицированные покупатели

---

### 7. QR-коды для начисления/списания
**UDS имеет:**
- Уникальный QR-код клиента в приложении
- Сканирование у кассира
- Моментальное начисление/списание баллов

**Адаптация для Loyal Spark:**
**Уже реализовано!** ✅
- Клиенты показывают свой wallet address через QR
- Мерчанты сканируют QR для выдачи токенов
- Все транзакции записываются в blockchain

**Улучшение:**
- Добавить генерацию одноразовых QR-кодов для безопасности
- История всех QR-транзакций

---

### 8. Онбординг и обучение
**UDS имеет:**
- Туториал при первом входе
- Подсказки по функционалу
- База знаний
- Видео-инструкции

**Адаптация для Loyal Spark:**
Создать:
- Welcome flow для новых пользователей
- Интерактивный тур по функциям
- Секция "Как это работает" для Web3 новичков
- FAQ по blockchain и токенам

---

## Структура страниц

### Для клиентов (Customer Page)
```
/customer
├── /dashboard (главная с балансами всех токенов)
├── /programs (все доступные программы лояльности)
├── /vouchers (мои ваучеры)
├── /rewards (каталог наград)
├── /history (история транзакций)
├── /referrals (реферальная программа)
├── /profile (профиль и настройки)
└── /reviews (мои отзывы)
```

### Для мерчантов (Merchant Page)
```
/merchant
├── /dashboard (аналитика и ключевые метрики)
├── /customers (CRM - база клиентов)
│   ├── /segments (RFM сегментация)
│   └── /filters (фильтры клиентов)
├── /program (настройки программы лояльности)
│   ├── /tiers (уровни клиентов)
│   └── /rules (правила начисления)
├── /rewards (управление наградами)
├── /vouchers (выданные ваучеры)
├── /marketing (push-уведомления и кампании)
├── /referrals (настройки реферальной программы)
├── /reviews (отзывы клиентов)
├── /mint (выдача токенов)
└── /analytics (детальная аналитика)
    ├── /sales (статистика продаж)
    ├── /customers (анализ клиентов)
    └── /roi (ROI программы)
```

---

## Приоритеты внедрения

### Фаза 1: Базовый CRM и аналитика (1-2 недели)
1. ✅ **Расширенные профили клиентов** - таблица customer_profiles
2. ✅ **RFM сегментация** - автоматическая классификация клиентов
3. ✅ **Дашборд мерчанта** - ключевые метрики и графики
4. ✅ **Фильтры клиентов** - поиск и сегментация

### Фаза 2: Уровни лояльности (1 неделя)
1. ✅ **Система уровней** - Bronze, Silver, Gold, Platinum
2. ✅ **Автоматическое повышение уровня** - на основе баланса токенов
3. ✅ **Мультипликаторы кэшбека** - разные % для разных уровней
4. ✅ **Приветственные бонусы** - при присоединении к программе

### Фаза 3: Маркетинг и коммуникации (1 неделя)
1. ✅ **Push-уведомления** - система рассылок
2. ✅ **Сегментированные кампании** - таргетинг по RFM
3. ✅ **Персонализированные акции** - индивидуальные предложения
4. ✅ **Email/SMS интеграция** - опционально

### Фаза 4: Реферальная программа (3-5 дней)
1. ✅ **Реферальные коды** - уникальные ссылки
2. ✅ **Бонусы рефералам** - автоматическое начисление
3. ✅ **Трекинг источников** - откуда пришел клиент
4. ✅ **Статистика рефералов** - для мерчантов

### Фаза 5: Отзывы и репутация (3-5 дней)
1. ✅ **Система рейтингов** - 1-5 звезд
2. ✅ **Верифицированные отзывы** - только от реальных покупателей
3. ✅ **Ответы мерчантов** - на отзывы
4. ✅ **Публичные рейтинги** - для всех программ

---

## Web3 преимущества Loyal Spark

### Что делает нас лучше UDS:

1. **Настоящее владение токенами**
   - UDS: баллы = записи в базе данных, контролируются компанией
   - Loyal Spark: токены = реальные активы на blockchain, принадлежат клиенту

2. **Ликвидность токенов**
   - UDS: баллы можно использовать только у мерчанта
   - Loyal Spark: токены можно продать на DEX, обменять, подарить

3. **Прозрачность**
   - UDS: централизованная система, trust required
   - Loyal Spark: все транзакции в блокчейне, trustless

4. **Кросс-программы**
   - UDS: баллы разных компаний изолированы
   - Loyal Spark: токены можно использовать в экосистеме DEX

5. **Нет инфляции**
   - UDS: компания может менять правила, обесценить баллы
   - Loyal Spark: supply токенов фиксирован в смарт-контракте

6. **Международность**
   - UDS: привязка к стране/региону
   - Loyal Spark: работает глобально через blockchain

---

## Технический стек для реализации

### Frontend компоненты
- React + TypeScript (уже есть)
- TanStack Query для кэширования
- Recharts для графиков и аналитики
- React Hook Form для форм

### Backend (Supabase)
- PostgreSQL для данных
- Row Level Security для безопасности
- Realtime для live обновлений
- Edge Functions для бизнес-логики

### Web3
- Wagmi для взаимодействия с blockchain
- Viem для работы с смарт-контрактами
- Base Sepolia testnet (уже используется)

---

## Следующие шаги

Выберите, с какой фазы хотите начать:

1. **Фаза 1: CRM и аналитика** - самый высокий приоритет
2. **Фаза 2: Уровни лояльности** - геймификация
3. **Фаза 3: Маркетинг** - удержание клиентов
4. **Фаза 4: Рефералы** - привлечение клиентов
5. **Фаза 5: Отзывы** - социальное доказательство

Или начнем с комплексного обновления дизайна главной страницы в стиле UDS?
