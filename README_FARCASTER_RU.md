# Loyal Spark - Приложение для Farcaster

Децентрализованное приложение программ лояльности, интегрированное с социальной сетью Farcaster и построенное на блокчейн-технологиях.

## 📁 Структура Проекта

**Основная папка приложения**: Корневая директория проекта, где вы сейчас находитесь.

```
loyal-spark-farcaster/
├── src/                          # Основной исходный код приложения
│   ├── components/               # React компоненты
│   │   ├── RoleSelector.tsx     # Выбор роли (мерчант/покупатель)
│   │   ├── AuthPrompt.tsx       # Подсказка для аутентификации
│   │   ├── MerchantPanel.tsx    # Панель мерчанта
│   │   └── CustomerPanel.tsx    # Панель покупателя
│   ├── contexts/                 # React контексты
│   │   └── AuthContext.tsx      # Контекст аутентификации
│   ├── pages/                    # Страницы приложения
│   │   ├── Index.tsx            # Главная страница
│   │   ├── AppPage.tsx          # Основная страница приложения
│   │   ├── MerchantPage.tsx     # Страница мерчанта (устаревшая)
│   │   └── CustomerPage.tsx     # Страница покупателя (устаревшая)
│   ├── hooks/                    # Пользовательские React хуки
│   ├── config/                   # Конфигурационные файлы
│   │   ├── wagmi.ts             # Настройки Web3/блокчейна
│   │   └── contracts.ts         # Адреса смарт-контрактов
│   └── lib/                      # Утилиты и вспомогательные функции
├── public/                       # Статические файлы
│   └── media-kit/               # Брендбук и медиа-материалы
├── supabase/                     # Конфигурация бэкенда (Lovable Cloud)
│   ├── functions/               # Серверные функции
│   └── migrations/              # Миграции базы данных
├── FARCASTER_APP_README.md      # Документация (английский)
├── README_FARCASTER_RU.md       # Этот файл (русский)
└── package.json                 # Зависимости проекта
```

## 🎯 Обзор

Приложение Loyal Spark для Farcaster позволяет мерчантам и покупателям участвовать в токенизированной экосистеме лояльности через социальную сеть Farcaster. Пользователи могут аутентифицироваться с помощью своего Farcaster аккаунта и выбрать роль (мерчант или покупатель) для доступа к соответствующим функциям.

## ✨ Возможности

### Для Мерчантов
- **Создание программ лояльности**: Развертывание ERC-20 токенов лояльности в блокчейне
- **Выпуск токенов**: Награждение клиентов токенами лояльности
- **Управление наградами**: Создание и управление ваучерами-наградами
- **Отслеживание программ**: Мониторинг распределения токенов и статуса программ
- **Установка срока действия**: Настройка дат окончания программ с автоматическим сжиганием токенов

### Для Покупателей
- **Сбор токенов**: Получение токенов лояльности от мерчантов
- **Просмотр портфолио**: Отслеживание всех собранных токенов в одном месте
- **Обмен наград**: Обмен токенов на ваучеры мерчантов
- **Торговля на DEX**: Обмен токенов на децентрализованных биржах
- **Управление ваучерами**: Просмотр и использование погашенных ваучеров

## 🔧 Технологический Стек

- **Frontend**: React 18 + TypeScript + Vite
- **Стилизация**: Tailwind CSS с кастомной дизайн-системой
- **Блокчейн**: Wagmi + Viem + RainbowKit для Web3 интеграции
- **Аутентификация**: Farcaster Auth Kit + Supabase
- **Backend**: Lovable Cloud (на основе Supabase)
- **Управление состоянием**: React Query (TanStack Query)
- **Роутинг**: React Router v6
- **UI Компоненты**: Radix UI + shadcn/ui

## 📋 Предварительные Требования

Перед началом установки убедитесь, что у вас есть:

1. **Node.js 18+** или **Bun** (менеджер пакетов)
2. **Криптокошелек** (MetaMask, Rainbow, Coinbase Wallet и т.д.)
3. **Аккаунт Farcaster** - [Создать аккаунт](https://www.farcaster.xyz/)
4. **Git** для клонирования репозитория

## 🚀 Установка и Настройка

### Шаг 1: Клонирование Репозитория

```bash
# Клонируйте репозиторий
git clone <URL-вашего-репозитория>

# Перейдите в директорию проекта
cd loyal-spark-farcaster
```

### Шаг 2: Установка Зависимостей

```bash
# Используя npm
npm install

# Или используя Bun (быстрее)
bun install
```

### Шаг 3: Настройка Переменных Окружения

Проект использует Lovable Cloud для бэкенд-сервисов. Переменные окружения настраиваются автоматически:

- `VITE_SUPABASE_URL` - URL базы данных
- `VITE_SUPABASE_PUBLISHABLE_KEY` - Публичный ключ для доступа к API
- `VITE_SUPABASE_PROJECT_ID` - ID проекта

**Важно**: Файл `.env` генерируется автоматически и не требует ручного редактирования.

### Шаг 4: Настройка Блокчейн Конфигурации

Откройте файл `src/config/wagmi.ts` и настройте:

```typescript
// Выберите нужные сети
export const config = getDefaultConfig({
  appName: 'Loyal Spark',
  projectId: 'ваш-walletconnect-project-id',
  chains: [mainnet, polygon, optimism, arbitrum, base],
  // ... остальные настройки
});
```

Получите **WalletConnect Project ID**:
1. Перейдите на [WalletConnect Cloud](https://cloud.walletconnect.com/)
2. Создайте новый проект
3. Скопируйте Project ID
4. Вставьте в `projectId` в файле `wagmi.ts`

### Шаг 5: Настройка Адресов Смарт-Контрактов

Смарт-контракты **уже развернуты** на сети **BASE**:

```
LoyaltyTokenFactory: 0x5F3DdBa12580CFdc6016258774cCc19C4250dA80
LoyalSparkERC20 (Implementation): 0xe6BA426C9c51281B929a17444De02c65815E27C3
Сеть: BASE (Chain ID: 8453)
```

Адреса уже настроены в файле `src/config/contracts.ts`.

### Шаг 6: Запуск Приложения

```bash
# Режим разработки
npm run dev
# или
bun dev

# Приложение будет доступно по адресу http://localhost:8080
```

### Шаг 7: Сборка для Продакшена

```bash
# Создание production сборки
npm run build
# или
bun build

# Результат будет в папке dist/
```

## 🔐 Интеграция с Farcaster

### Что такое Farcaster?

Farcaster - это децентрализованная социальная сеть, построенная на блокчейне. Она позволяет пользователям владеть своими социальными связями и данными.

### Как работает аутентификация через Farcaster

Приложение использует **Farcaster Auth Kit** для безопасной аутентификации:

1. **Подключение кошелька**: Пользователь подключает криптокошелек через RainbowKit
2. **Подпись сообщения**: Пользователь подписывает сообщение аутентификации для Farcaster
3. **Создание сессии**: Создается защищенная сессия в базе данных (Lovable Cloud)
4. **Синхронизация профиля**: Профиль пользователя синхронизируется с адресом кошелька
5. **Выбор роли**: Пользователь выбирает роль (мерчант или покупатель)

### Настройка Farcaster Auth Kit (Подробно)

#### Шаг 1: Получение Farcaster App ID

1. Перейдите на [Farcaster Developers](https://developers.farcaster.xyz/)
2. Войдите с помощью своего Farcaster аккаунта
3. Создайте новое приложение:
   - Название: "Loyal Spark"
   - Описание: "Decentralized loyalty rewards platform"
   - URL: `http://localhost:8080` (для разработки)
4. Скопируйте **App ID**

#### Шаг 2: Настройка Auth Kit в Коде

Откройте файл `src/contexts/AuthContext.tsx` и обновите конфигурацию:

```typescript
import { AuthKitProvider } from '@farcaster/auth-kit';

// Добавьте конфигурацию Farcaster Auth Kit
const farcasterConfig = {
  rpcUrl: 'https://mainnet.optimism.io',
  domain: 'loyal-spark.app',
  siweUri: 'http://localhost:8080',
};
```

#### Шаг 3: Обертка приложения в AuthKitProvider

В файле `src/App.tsx` приложение уже обернуто провайдером:

```typescript
<AuthProvider>
  {/* Ваше приложение */}
</AuthProvider>
```

#### Шаг 4: Тестирование Аутентификации

1. Запустите приложение: `npm run dev`
2. Откройте http://localhost:8080/app
3. Нажмите "Connect Wallet"
4. Выберите кошелек и подключитесь
5. Подпишите сообщение аутентификации
6. Выберите роль (Мерчант или Покупатель)

## 🎭 Система Выбора Роли

### Как работает выбор роли

Приложение поддерживает две роли пользователей:

#### 1. **Мерчант (Merchant)**
- Создает программы лояльности
- Выпускает токены покупателям
- Управляет наградами и ваучерами
- Отслеживает статистику программ

#### 2. **Покупатель (Customer)**
- Собирает токены от разных мерчантов
- Просматривает баланс токенов
- Обменивает токены на награды
- Управляет ваучерами

### Технические детали

Роль пользователя хранится в таблице `profiles` базы данных:

```sql
-- Структура таблицы profiles
CREATE TABLE profiles (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users,
  wallet_address TEXT UNIQUE NOT NULL,
  role TEXT CHECK (role IN ('merchant', 'customer')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Переключение между ролями

Пользователи могут в любой момент изменить свою роль:

1. Нажмите кнопку "Изменить роль" в верхней части страницы
2. Выберите новую роль
3. Роль обновится в базе данных автоматически

Реализация в `src/pages/AppPage.tsx`:

```typescript
const handleBackToRoleSelection = () => {
  setSelectedRole(null); // Сброс роли для повторного выбора
};
```

## 💾 База Данных (Lovable Cloud)

### Схема Базы Данных

#### Таблица: profiles
Хранит информацию о пользователях:
- `user_id`: ID аутентифицированного пользователя
- `wallet_address`: Адрес криптокошелька (уникальный)
- `role`: Выбранная роль ('merchant' или 'customer')

#### Таблица: loyalty_programs
Программы лояльности, созданные мерчантами:
- `token_address`: Адрес токена в блокчейне
- `merchant_address`: Адрес кошелька мерчанта
- `name`: Название программы
- `symbol`: Символ токена (например, "CAFE")
- `status`: Статус ('active', 'paused', 'expired')
- `expiration_date`: Дата окончания программы

#### Таблица: rewards
Награды, созданные мерчантами:
- `merchant_address`: Владелец награды
- `token_address`: Токен для обмена
- `name`: Название награды
- `description`: Описание
- `cost`: Стоимость в токенах
- `is_active`: Активна ли награда

#### Таблица: vouchers
Ваучеры, погашенные покупателями:
- `customer_address`: Покупатель
- `merchant_address`: Мерчант
- `reward_id`: Связанная награда
- `code`: Уникальный код ваучера
- `status`: Статус ('active', 'used')
- `used_at`: Дата использования

### Правила Безопасности (RLS)

Row Level Security обеспечивает безопасность данных:

```sql
-- Пример: Пользователи видят только свои профили
CREATE POLICY "Users can view own profile"
ON profiles FOR SELECT
USING (auth.uid() = user_id);

-- Мерчанты управляют только своими программами
CREATE POLICY "Merchants manage own programs"
ON loyalty_programs FOR ALL
USING (merchant_address = (
  SELECT wallet_address FROM profiles 
  WHERE user_id = auth.uid()
));
```

### Серверные Функции (Edge Functions)

Расположение: `supabase/functions/`

#### check-program-expiration
Автоматически проверяет истекшие программы:
- Запускается по расписанию
- Обновляет статусы программ
- Отправляет уведомления (опционально)

#### get-token-holders
Получает список держателей токенов:
- Анализирует блокчейн
- Возвращает балансы пользователей
- Используется для аналитики

## 🔗 Смарт-Контракты

### Архитектура Контрактов

#### LoyaltyTokenFactory
**Назначение**: Фабрика для создания новых токенов лояльности

**Основные функции**:
```solidity
function deployLoyaltyToken(
  string memory name,
  string memory symbol
) external returns (address)
```

#### LoyalSparkERC20
**Назначение**: Токен лояльности стандарта ERC-20

**Основные функции**:
```solidity
function mint(address to, uint256 amount) external onlyOwner
function burn(uint256 amount) external
function pause() external onlyOwner
function unpause() external onlyOwner
```

### Информация о Развернутых Смарт-Контрактах

Смарт-контракты **уже развернуты** на сети BASE и готовы к использованию:

**Адреса контрактов:**
```
LoyaltyTokenFactory: 0x5F3DdBa12580CFdc6016258774cCc19C4250dA80
LoyalSparkERC20 (Implementation): 0xe6BA426C9c51281B929a17444De02c65815E27C3
```

**Сеть:** BASE (Chain ID: 8453)

**Проверка контрактов:**
- Вы можете просмотреть контракты на [BaseScan](https://basescan.org/)
- LoyaltyTokenFactory: https://basescan.org/address/0x5F3DdBa12580CFdc6016258774cCc19C4250dA80
- LoyalSparkERC20: https://basescan.org/address/0xe6BA426C9c51281B929a17444De02c65815E27C3

**Настройка в коде:**

Адреса уже настроены в `src/config/contracts.ts`:

```typescript
export const CONTRACTS = {
  LOYALTY_TOKEN_FACTORY: {
    address: '0x5F3DdBa12580CFdc6016258774cCc19C4250dA80',
    abi: [/* ABI контракта */]
  },
  LOYAL_SPARK_ERC20: {
    address: '0xe6BA426C9c51281B929a17444De02c65815E27C3',
    abi: [/* ABI контракта */]
  }
};

export const BASE_CHAIN_ID = 8453;
```

**Примечание:** Развертывание новых контрактов не требуется. Приложение готово к использованию с текущими адресами.

## 📱 Использование Приложения

### Для Мерчантов

#### 1. Первоначальная Настройка
1. Перейдите на http://localhost:8080/app
2. Нажмите "Connect Wallet"
3. Подключите кошелек (MetaMask, Rainbow и т.д.)
4. Нажмите "Sign in with Wallet"
5. Выберите роль "Merchant"

#### 2. Создание Программы Лояльности
1. На панели мерчанта нажмите "Create Loyalty Program"
2. Заполните форму:
   - **Name**: Название программы (например, "Coffee Rewards")
   - **Symbol**: Символ токена (например, "CAFE")
   - **Expiration Date**: Дата окончания программы
3. Нажмите "Deploy Token"
4. Подтвердите транзакцию в кошельке
5. Дождитесь подтверждения в блокчейне

#### 3. Выпуск Токенов Покупателям
1. Выберите программу из списка
2. Нажмите "Issue Tokens"
3. Введите:
   - **Customer Address**: Адрес кошелька покупателя
   - **Amount**: Количество токенов
4. Подтвердите транзакцию
5. Покупатель получит токены на свой кошелек

#### 4. Создание Наград
1. Перейдите на вкладку "Rewards"
2. Нажмите "Create Reward"
3. Заполните:
   - **Name**: Название награды
   - **Description**: Описание
   - **Token**: Выберите токен
   - **Cost**: Стоимость в токенах
4. Нажмите "Create"

#### 5. Управление Ваучерами
1. Перейдите на вкладку "Vouchers"
2. Просматривайте погашенные ваучеры
3. Отмечайте использованные ваучеры

### Для Покупателей

#### 1. Первоначальная Настройка
1. Перейдите на http://localhost:8080/app
2. Подключите кошелек
3. Войдите через Farcaster
4. Выберите роль "Customer"

#### 2. Просмотр Токенов
1. На панели покупателя увидите все ваши токены
2. Каждая карточка показывает:
   - Название токена
   - Символ
   - Ваш баланс
   - Адрес мерчанта

#### 3. Обмен Токенов на Награды
1. Нажмите на токен для просмотра доступных наград
2. Выберите желаемую награду
3. Проверьте стоимость в токенах
4. Нажмите "Redeem Reward"
5. Подтвердите транзакцию
6. Получите уникальный код ваучера

#### 4. Использование Ваучеров
1. Перейдите на вкладку "My Vouchers"
2. Найдите нужный ваучер
3. Покажите код мерчанту
4. Мерчант отметит ваучер как использованный

#### 5. Торговля на DEX (будущая функция)
1. Перейдите на вкладку "Trade"
2. Выберите токены для обмена
3. Укажите количество
4. Подтвердите обмен

## 🚀 Деплой и Публикация

### Деплой через Lovable

1. **Нажмите кнопку "Publish"** в правом верхнем углу редактора Lovable
2. Приложение автоматически развернется
3. Получите URL: `https://ваш-проект.lovable.app`

### Подключение Собственного Домена

1. Перейдите в **Project > Settings > Domains** в Lovable
2. Добавьте свой домен (например, `loyalspark.app`)
3. Настройте DNS записи у вашего регистратора:
   ```
   Type: CNAME
   Name: @
   Value: <предоставленное-lovable-значение>
   ```
4. Дождитесь распространения DNS (до 48 часов)

### Создание Отдельного Репозитория

#### Вариант 1: Через Lovable GitHub Integration (Рекомендуется)

1. **Подключение к GitHub**:
   - В Lovable нажмите: **GitHub → Connect to GitHub**
   - Авторизуйте Lovable GitHub App
   - Выберите аккаунт/организацию GitHub

2. **Создание Репозитория**:
   - Нажмите **"Create Repository"**
   - Введите название: `loyal-spark-farcaster`
   - Репозиторий создастся с текущим кодом

3. **Автоматическая Синхронизация**:
   - Изменения в Lovable → автоматически в GitHub
   - Изменения в GitHub → автоматически в Lovable
   - Синхронизация в реальном времени

#### Вариант 2: Ручной Экспорт

1. **Экспорт из Lovable**:
   - Скачайте проект как ZIP
   - Распакуйте в локальную папку

2. **Создание Репозитория на GitHub**:
   - Перейдите на GitHub.com
   - Нажмите **"New repository"**
   - Название: `loyal-spark-farcaster`
   - Нажмите **"Create repository"**

3. **Загрузка Кода**:
   ```bash
   cd путь/к/распакованному/проекту
   git init
   git add .
   git commit -m "Initial commit: Loyal Spark Farcaster App"
   git branch -M main
   git remote add origin https://github.com/ваш-username/loyal-spark-farcaster.git
   git push -u origin main
   ```

### Деплой на Vercel

1. **Подключите репозиторий к Vercel**:
   - Перейдите на [Vercel](https://vercel.com)
   - Нажмите "Import Project"
   - Выберите ваш GitHub репозиторий

2. **Настройте переменные окружения**:
   ```
   VITE_SUPABASE_URL=ваш-supabase-url
   VITE_SUPABASE_PUBLISHABLE_KEY=ваш-ключ
   ```

3. **Настройки сборки** (автоматически определяются):
   - Build Command: `npm run build`
   - Output Directory: `dist`

4. **Deploy**: Нажмите "Deploy"

## 🔍 Отладка и Решение Проблем

### Проблемы с Подключением Кошелька

**Симптом**: Кнопка "Connect Wallet" не работает

**Решения**:
1. Проверьте, установлено ли расширение кошелька
2. Убедитесь, что кошелек разблокирован
3. Очистите кэш браузера
4. Попробуйте другой браузер

### Ошибки при Транзакциях

**Симптом**: Транзакция не проходит

**Решения**:
1. **Недостаточно газа**:
   - Проверьте баланс ETH/MATIC
   - Пополните кошелек для оплаты комиссии
2. **Неправильная сеть**:
   - Убедитесь, что выбрана правильная сеть
   - Переключите сеть в кошельке
3. **Адрес контракта**:
   - Проверьте `src/config/contracts.ts`
   - Убедитесь, что адрес правильный

### Ошибки Аутентификации

**Симптом**: Не получается войти через Farcaster

**Решения**:
1. Очистите localStorage:
   ```javascript
   // В консоли браузера
   localStorage.clear()
   ```
2. Отключите и подключите кошелек заново
3. Проверьте статус сессии в базе данных
4. Убедитесь, что у вас есть аккаунт Farcaster

### Проблемы с База Данных

**Симптом**: Данные не сохраняются

**Решения**:
1. Проверьте переменные окружения (`.env`)
2. Убедитесь, что Lovable Cloud активен
3. Проверьте RLS политики:
   ```sql
   -- В Lovable Cloud консоли
   SELECT * FROM profiles WHERE user_id = auth.uid();
   ```

### Ошибки Компиляции

**Симптом**: `npm run build` падает с ошибкой

**Решения**:
1. Удалите `node_modules` и переустановите:
   ```bash
   rm -rf node_modules
   npm install
   ```
2. Проверьте версию Node.js:
   ```bash
   node --version  # Должно быть 18+
   ```
3. Проверьте TypeScript ошибки:
   ```bash
   npm run type-check
   ```

## 📚 Дополнительные Ресурсы

### Документация

- **Lovable**: https://docs.lovable.dev
- **Farcaster Auth Kit**: https://docs.farcaster.xyz/auth-kit/
- **Wagmi**: https://wagmi.sh/
- **RainbowKit**: https://www.rainbowkit.com/docs/introduction
- **Supabase**: https://supabase.com/docs
- **Viem**: https://viem.sh/

### Обучающие Материалы

- [Lovable YouTube Плейлист](https://www.youtube.com/watch?v=9KHLTZaJcR8&list=PLbVHz4urQBZkJiAWdG8HWoJTdgEysigIO)
- [Farcaster для Разработчиков](https://docs.farcaster.xyz/)
- [Web3 для Начинающих](https://ethereum.org/en/developers/docs/)

### Сообщество

- **Lovable Discord**: https://discord.gg/lovable
- **Farcaster Discord**: https://discord.gg/farcaster
- **Stack Overflow**: Тег `farcaster` или `wagmi`

## 🛠 Расширенная Настройка

### Добавление Новых Сетей

Отредактируйте `src/config/wagmi.ts`:

```typescript
import { avalanche, bsc } from 'wagmi/chains';

export const config = getDefaultConfig({
  chains: [
    mainnet, 
    polygon, 
    avalanche,  // Новая сеть
    bsc         // Еще одна сеть
  ],
  // ...
});
```

### Кастомизация Дизайна

1. **Цвета**: Отредактируйте `src/index.css`:
   ```css
   :root {
     --primary: 210 100% 50%;  /* HSL значения */
     --secondary: 280 60% 60%;
   }
   ```

2. **Компоненты**: Используйте Tailwind классы:
   ```typescript
   <Button className="bg-primary text-white hover:bg-primary/90">
     Моя Кнопка
   </Button>
   ```

### Добавление Аналитики

```typescript
// src/lib/analytics.ts
export const trackEvent = (event: string, data?: any) => {
  // Google Analytics
  gtag('event', event, data);
  
  // Или другой сервис
  analytics.track(event, data);
};
```

## 📄 Лицензия

MIT License - см. файл LICENSE для деталей

## 🤝 Поддержка

- **Баг-репорты**: Создайте issue на GitHub
- **Вопросы**: Задайте в Discussions на GitHub
- **Email**: info@loyalspark.online

## 🗺 Дорожная Карта

- [ ] Мобильное приложение с Capacitor
- [ ] Поддержка нескольких блокчейнов
- [ ] Расширенные функции DEX
- [ ] Дашборд аналитики для мерчантов
- [ ] Рекомендации наград для покупателей
- [ ] Социальные функции с интеграцией Farcaster
- [ ] NFT награды
- [ ] Геймификация программ лояльности

---

**Создано с помощью Lovable** ❤️

Если у вас есть вопросы или нужна помощь, не стесняйтесь обращаться в наше сообщество!