# План: единая идентичность пользователя (wallet + email)

> **Изменения после ревью:** телефон отложен (Privy SMS / Twilio плохо работают по России — нужен глобальный провайдер, обсудим отдельно). Схема `identity_links` фиксируется в варианте `(link_type, value)`. Схлопывание дублей по email — отдельный релиз с бэкапом, не в первой итерации.

---

## 1. Текущее состояние (после отката + сверка с репо)

Сверено с кодом на 2026-04-23:

- ✅ Таблица `identity_links (user_id, wallet_address, is_primary, linked_via, verified_at)` существует.
- ✅ RPC `get_my_identity_summary()` и `set_primary_wallet(text)` есть.
- ❌ Таблица **пустая** — никто туда не пишет (`privy-auth`, `siwe-verify` её не трогают).
- ❌ В `src/` и `supabase/functions/` **нет** ни `LinkExternalWalletCard`, ни `link-secondary-wallet`, ни `link_identity` — все экспериментальные артефакты удалены при откате.
- ✅ `profiles.wallet_address` имеет уникальный индекс — это база, ломать не будем.
- ✅ `privy-auth` делает `upsert ... onConflict: 'wallet_address'` — **сохраняет защиту от петли привязки** (если кошелёк уже принадлежит другому user_id, текущая логика не перезаписывает; нужно подтвердить тестом перед миграцией).
- ✅ `resolve-recipient` ищет только в `profiles` по email/phone.

**Вывод:** стартовая точка чистая, второй параллельной схемы нет, миграцию делаем поверх существующей `identity_links`.

---

## 2. Финальная схема `identity_links` (фиксируем сейчас)

Выбираем **вариант с `(link_type, value)`** — один формат хранения для wallet и email, расширяемо под phone/passkey/social в будущем без `ALTER TABLE`.

```sql
identity_links
  id              uuid PK
  user_id         uuid NOT NULL  -- ссылка на auth.users
  link_type       text NOT NULL  -- 'wallet' | 'email' (phone/oauth — позже)
  value           text NOT NULL  -- адрес 0x… или email
  value_normalized text NOT NULL -- lower(value); по нему уникальный индекс
  is_primary      boolean NOT NULL DEFAULT false
  verified_via    text NOT NULL  -- 'siwe' | 'privy_embedded' | 'privy_oauth' | 'magic_link' | 'farcaster' | …
  verified_at     timestamptz NOT NULL DEFAULT now()
  created_at      timestamptz NOT NULL DEFAULT now()

UNIQUE (link_type, value_normalized)         -- один email/wallet принадлежит одному user_id
UNIQUE (user_id, link_type) WHERE is_primary -- ровно один primary каждого типа
```

**Миграция данных:** существующая колонка `wallet_address` копируется в `value`, `link_type='wallet'`, `linked_via` → `verified_via`. Старая колонка какое-то время остаётся (nullable) для обратной совместимости — удалим после полного перехода UI.

**Связь с `profiles`:**
- `profiles.wallet_address` остаётся уникальным и продолжает быть «активным/primary wallet».
- При смене primary через `set_primary_wallet()` — обновляем и `identity_links.is_primary`, и `profiles.wallet_address`.
- `profiles.email` остаётся «отображаемым primary email», но теперь синхронизируется с `identity_links` (тип `'email'`, primary).
- Вторичные кошельки/email — **только** в `identity_links`, в `profiles` не дублируются.

---

## 3. Защита от hijack — что меняем в `privy-auth`

Текущая защита (`onConflict: 'wallet_address'`) спасает от перезаписи user_id на чужой кошелёк, но **молчаливо**: пользователь не понимает, почему его embedded wallet «подцепился» к старому аккаунту.

После миграции `privy-auth`:
1. Lookup по **Privy DID** (`did:privy:...`) — храним в `identity_links` как `link_type='privy_did'` (отдельный type, не конфликтует с wallet/email).
2. Если DID найден — возвращаем существующий user_id, не трогаем кошельки.
3. Если DID новый — создаём `auth.users` + `profiles` + первый `identity_links{wallet}` + `identity_links{privy_did}`.
4. При попытке embedded wallet с DID привязаться к адресу, который уже в `identity_links` другого user_id — **возвращаем ошибку с понятным кодом** (`wallet_belongs_to_another_account`), фронт показывает «Этот кошелёк уже привязан к другому аккаунту. Войдите через него или обратитесь в поддержку».

Это сохраняет текущую защиту и убирает молчаливое поведение.

---

## 4. Этапы (с учётом ревью)

### Этап 1 — Миграция БД (1 PR)

1. ALTER `identity_links`: добавить `link_type`, `value`, `value_normalized`, `verified_via`. Скопировать старые wallet-строки в новый формат. Старую колонку `wallet_address` оставить nullable.
2. Уникальные индексы `(link_type, value_normalized)` и `(user_id, link_type) WHERE is_primary`.
3. RPC:
   - `link_identity(p_link_type text, p_value text, p_verified_via text)` — пишет в `identity_links` для `auth.uid()`. Если `value` свободен — линкует. Если уже принадлежит этому user_id — no-op. Если чужому — `RAISE EXCEPTION 'identity_taken'`.
   - `unlink_identity(p_id uuid)` — удаляет, **запрещает** удалять последний wallet или primary без замены.
   - Пересоздать `get_my_identity_summary()` под новую схему (вернёт wallets и emails отдельными массивами).
   - Пересоздать `set_primary_wallet()` → переименовать в `set_primary(p_link_type, p_value)` с обратной совместимостью.
4. Обновить RLS таблицы под `auth.uid() = user_id` (она уже такая, но переподтвердить после ALTER).

**Список того, что нужно пройти после миграции:**
- `useResolveRecipient` / `resolve-recipient` — добавить поиск по `identity_links`.
- `privy-auth` — переход на lookup по Privy DID.
- `siwe-verify` — добавить «link mode» (если есть JWT, вызвать `link_identity('wallet', address, 'siwe')` вместо создания нового аккаунта).
- `useAuth` / `AuthContext` — после логина дозалить wallet в `identity_links` если ещё нет.

### Этап 2 — Edge functions

1. `privy-auth`: lookup по DID (см. раздел 3).
2. `siwe-verify`: link mode при наличии Bearer JWT.
3. `resolve-recipient`: порядок поиска
   1. `identity_links` (type='email', value=normalized) → primary wallet того же user_id.
   2. `identity_links` (type='wallet', value=normalized) → возврат сразу.
   3. Fallback: `profiles.email` (legacy, пока не схлопнем дубли).
   4. Fallback: `customer_profiles.email` (legacy).
   - Возвращать `display_name` если есть в `customer_profiles`/`merchant_profiles`.

### Этап 3 — UI «Linked accounts»

- Компонент `LinkedAccounts.tsx`:
  - Список linked wallets и emails с бейджами Primary/Verified, дата.
  - «Add wallet» → SIWE в link-mode.
  - «Add email» → Privy `linkEmail()` → callback `link_identity('email', …, 'privy_oauth'|'magic_link')`.
  - «Set as primary» / «Unlink» с подтверждением.
- Интеграция: `CustomerProfileSection.tsx`, `MerchantProfileSection.tsx`, `MobileProfileTab.tsx`.
- Активный wallet — продолжает работать через memory `mem://features/active-primary-wallet.md`.

### Этап 4 — Отдельный релиз: схлопывание дублей по email (НЕ в первой итерации)

- Перед стартом — бэкап БД, дамп `profiles` + `identity_links`.
- Скрипт: для каждого email с N>1 user_id — оставляем самого старого (`min(created_at)`), остальные пересаживаем (vouchers, mints, programs, employees…) на winner.user_id, дубли user_id мягко удаляем (через `admin_delete_user` или soft-flag).
- Аудит каждой склейки в `user_moderation_log` (action='auto_merge_email').
- После — включить уникальность `profiles.email`.

**Решение:** делаем **после** того, как Этапы 1–3 проживут в проде неделю-две и мы увидим реальное распределение дублей.

### Этап 5 — Phone (отложен до выбора провайдера)

- Privy SMS и Twilio не подходят (плохая доставка по России).
- Кандидаты для глобального покрытия + RU: **Vonage (Nexmo)**, **MessageBird/Bird**, **Plivo**, **SMS Aero/SMSC.ru гибрид через Vonage backup**. У всех есть международный sender и работа по РФ через локальных агрегаторов.
- Перед реализацией — обсудить выбор отдельно. До этого: телефон как опциональное поле в `customer_profiles` без верификации (как сейчас).

---

## 5. Риски и решения (актуализированы)

| Риск | Решение |
|------|---------|
| Сломаем существующий код, который читает `identity_links.wallet_address` | Колонка остаётся nullable до миграции UI; новые чтения через `value WHERE link_type='wallet'`. Пройти grep'ом всё перед удалением. |
| Privy DID меняется при пересоздании Privy app | DID хранится отдельным `link_type='privy_did'`; при смене app — fallback на email lookup. |
| Уже есть пользователи с одним email на нескольких user_id | Этап 1 НЕ включает уникальность по email в `profiles`. Дубли остаются до Этапа 4. На вход — `link_identity('email', …)` будет падать с `identity_taken` — это ожидаемо, попросим пройти merge. |
| Onchain история привязана к адресу, не к user_id | Этап 4 (агрегирующий view) — после стабилизации этапов 1–3. |
| `profiles.wallet_address` уникален → нельзя одному user_id иметь два wallet в profiles | И не нужно: вторые кошельки живут только в `identity_links`. `profiles.wallet_address` всегда = primary. |

---

## 6. Что предлагаю на первую итерацию

**Фаза 1 (один заход):** Этап 1 (миграция + RPC) + Этап 2 (`privy-auth` lookup по DID, `siwe-verify` link mode, `resolve-recipient` через `identity_links`) + Этап 3 (UI `LinkedAccounts` для wallet и email).

**Не делаем сейчас:** телефон, схлопывание email-дублей, агрегация баланса по нескольким wallet.

Подтверди, и я готовлю миграцию первым шагом (без изменений кода — сначала схема и RPC, потом отдельно edge-функции, потом UI). Так каждый кусок будет ревьюиться независимо и можно остановиться на любом этапе.
