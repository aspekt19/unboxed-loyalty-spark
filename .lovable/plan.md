# План: единая идентичность пользователя (wallet + email + phone)

## 1. Что такое «лучшие практики» в индустрии

Изучены подходы Privy, Dynamic.xyz, Thirdweb, Coinbase Smart Wallet и общие паттерны Web3 2024–2025. Сходятся в одном:

1. **Канонический ID — НЕ кошелёк и НЕ email.** Используется внутренний неизменяемый `user_id` (у Privy это DID `did:privy:...`). Кошельки, email, phone, OAuth — это **identity links** (1‑to‑many), которые могут добавляться/удаляться, но `user_id` постоянен.
2. **Один пользователь — много кошельков.** Embedded (Privy/CDP/Coinbase Smart Wallet) + внешний (MetaMask, WalletConnect) живут под одним аккаунтом. Пользователь выбирает «active wallet» для UI, но история и баланс агрегируются.
3. **Progressive linking.** Сначала вход (email/social) → embedded wallet создаётся автоматически → потом пользователь сам добавляет внешние кошельки/телефон через подтверждение (signature challenge для wallet, OTP для phone, magic link для email).
4. **Anti‑hijack защита:** при привязке нового идентификатора, который уже принадлежит другому аккаунту, — НЕ молча перезаписывать профиль. Либо отказ, либо явный merge‑flow с подтверждением с обеих сторон.
5. **Резолвер получателя по любому идентификатору** (email/phone/wallet/ENS/handle) — стандарт для loyalty/payments продуктов (Venmo, Revolut, и в Web3 — Coinbase username, Base names).
6. **PII под service-role.** Email/phone в RLS видны только владельцу или через `SECURITY DEFINER` RPC, остальным — маскируются (`mask_email`, `mask_phone` уже есть).

---

## 2. Где сейчас находится проект (после отката)

- ✅ `profiles` (user_id, wallet_address, email, phone) — основная таблица с **уникальностью по wallet_address**.
- ✅ `customer_profiles` (wallet_address, first_name, last_name, email, phone) — расширение для покупателей.
- ✅ `merchant_profiles` (merchant_address, business_name, …) — расширение для мерчантов.
- ✅ `identity_links` (user_id, wallet_address, is_primary, linked_via, verified_at) — таблица **уже существует** и есть RPC `get_my_identity_summary`, `set_primary_wallet`.
- ✅ `privy-auth` edge function — вход через Privy → создаёт строку в `profiles` с тем кошельком, который пришёл первым.
- ✅ `siwe-verify` edge function — чистый SIWE для wallet‑only входа.
- ✅ `resolve-recipient` edge function — резолвит email/phone → wallet_address (через `profiles`).
- ❌ **Нет UI для управления связанными аккаунтами** (добавить wallet, email, phone, удалить, выбрать primary).
- ❌ **Нет защиты от hijack**: `privy-auth` делает `upsert ... onConflict: 'wallet_address'` — если кто‑то залогинится через социалку и привяжет чужой адрес, он перезапишет `user_id` чужого профиля.
- ❌ **`identity_links` не наполняется автоматически** при входе — таблица есть, но пустая.
- ❌ Поиск получателя в `resolve-recipient` идёт только по `profiles`, игнорируя `customer_profiles` и `identity_links` (т.е. вторичные кошельки и контакты не найдутся).
- ❌ Нет **canonical user_id** в бизнес‑логике: вся история (минты, ваучеры, рефералы) привязана к `wallet_address` строкой — при добавлении второго кошелька баланс/история не объединяются.

---

## 3. Целевая модель

```
auth.users (Supabase user_id, неизменяемый)
   └── profiles (1:1, primary_wallet_address, email, phone)
        └── identity_links (1:N) ← все кошельки и контакты
              ├── { type: 'wallet',   value: '0x...',     verified_via: 'siwe'|'privy_embedded'|'farcaster' }
              ├── { type: 'email',    value: 'a@b.com',   verified_via: 'privy_oauth'|'magic_link' }
              └── { type: 'phone',    value: '+7...',     verified_via: 'privy_sms'|'twilio_otp' }
```

**Принципы:**
- `user_id` — единственный «истинный» ключ. UI и onchain‑слой продолжают работать с `wallet_address`, но это всегда **active wallet** (выбранный из списка `identity_links`).
- При социальном входе создаётся embedded wallet → пишется `identity_links { wallet, verified_via: 'privy_embedded', is_primary: true }`.
- При SIWE с того же устройства тот же `user_id` получает второй link `{ wallet: external, verified_via: 'siwe' }`.
- При попытке привязать кошелёк, уже принадлежащий другому `user_id` → **отказ с понятным сообщением** + опция «request merge» (фаза 2).

---

## 4. Этапы (поэтапно, без big‑bang)

### Этап 1 — Фундамент (БД + защита) ⚙️

**Цель:** ничего не ломая, привести таблицы в порядок и защитить от hijack.

1. Миграция БД:
   - `identity_links`: добавить колонку `link_type text` (`'wallet'|'email'|'phone'`) и расширить `wallet_address` на `value text` (или оставить `wallet_address` + nullable `email`, `phone` — выбрать в обсуждении).
   - Уникальный индекс `(link_type, lower(value))` — гарантирует, что один email/wallet/phone привязан только к одному `user_id`.
   - RPC `link_identity(type, value, proof)` — проверяет, что value свободен или уже принадлежит этому `user_id`; пишет в `identity_links`.
   - RPC `unlink_identity(link_id)` — нельзя удалить последний wallet или primary без переключения.
   - RPC `merge_request(target_user_id)` — фаза 2.
2. Edge function `privy-auth`:
   - **Перестать делать `upsert by wallet_address`.** Делать lookup `identity_links` по `did:privy:...` (новая колонка `external_id` для Privy DID) → если пользователь существует, возвращать его сессию; если нет — создавать `auth.users` + `profiles` + первый `identity_links`.
   - При появлении нового кошелька от того же DID — пытаться сделать `link_identity`, при конфликте — логировать, но не падать.
3. Edge function `siwe-verify`:
   - Если в запросе есть Bearer JWT уже залогиненного пользователя — это **«link mode»**: вызывать `link_identity('wallet', address, signature)` для текущего `user_id` вместо создания нового аккаунта.
   - Без JWT — текущее поведение (создать аккаунт по адресу).

### Этап 2 — UI: «Linked accounts» ⚙️

**Цель:** дать пользователю прозрачно управлять идентичностью.

1. Новая секция в `CustomerProfileSection.tsx` и `MerchantProfileSection.tsx` (а также `MobileProfileTab.tsx`):
   - Список linked accounts с бейджами (Primary, Verified, тип).
   - Кнопки «Add wallet» (запускает SIWE в link‑mode), «Add email» (Privy `linkEmail()`), «Add phone» (Privy `linkPhone()`), «Set as primary», «Unlink».
2. Глобальный селектор «Active wallet» в шапке (если linked > 1 wallets) — переключает то, под каким адресом UI делает onchain операции. Уже есть memory `mem://features/active-primary-wallet.md` — расширим её.
3. Inline‑верификация телефона через Privy SMS (бесплатно для ≤5K MAU) — никаких отдельных Twilio.

### Этап 3 — Resolver и поиск получателя 🔍

**Цель:** «отправь токены jane@example.com» и «+7912…» работает на любой связанный кошелёк.

1. `resolve-recipient` ищет в порядке:
   1. `identity_links` по `(type='email'|'phone', value)` → берёт **primary wallet** связанного `user_id`.
   2. Fallback — `profiles.email/phone` (legacy).
   3. Fallback — `customer_profiles.email/phone`.
2. Возвращать вместе с адресом ник `display_name` (если есть) — UI покажет «Sending to Jane Doe (0xabc…)».

### Этап 4 — Унификация бизнес‑логики (опционально, фаза 3) 🧮

**Цель:** баланс, история и tier по **всем** связанным кошелькам, а не только по active.

1. View `merchant_user_aggregate(user_id, token_address)` — суммирует балансы и mint history по всем linked wallets.
2. Tier и RFM считаются по `user_id`, а не по `wallet_address`.
3. Это дорогая работа — делаем после того, как UI и линковка работают.

---

## 5. Что предлагаю сделать **в первой итерации** (3 шага, минимально полезные)

> **Шаг А (миграция):** расширить `identity_links` под email/phone, добавить уникальный индекс, RPC `link_identity` / `unlink_identity`, защитить `privy-auth` от hijack (lookup по Privy DID, а не по wallet_address).
> **Шаг Б (бэкенд):** включить «link mode» в `siwe-verify` (если уже залогинен — добавить wallet к текущему user_id). Расширить `resolve-recipient` под `identity_links`.
> **Шаг В (UI):** компонент `LinkedAccounts.tsx` (список + добавить wallet/email/phone + set primary + unlink), интегрировать в `CustomerProfileSection`, `MerchantProfileSection`, `MobileProfileTab`. Селектор active wallet — оставить как уже есть в `mem://features/active-primary-wallet.md`.

После этого Этап 4 (агрегация баланса/истории) — отдельным заходом, когда продукт подтвердит, что пользователям это нужно.

---

## 6. Риски и решения

| Риск | Решение |
|------|---------|
| Существующие пользователи имеют дубли (один и тот же email на нескольких `user_id` через разные адреса) | Скрипт миграции: схлопнуть дубли по email (старший `created_at` побеждает), записать в `user_moderation_log` для аудита. |
| Privy DID меняется при пересоздании Privy app | Хранить `did` в `identity_links` как `link_type='privy_did'`, плюс fallback по email. |
| Пользователь теряет primary wallet (потерял ключ от MetaMask) | UI «Set as primary» позволяет переключить на любой verified link, primary никогда не «жёстко удаляется» без замены. |
| Onchain история всё равно привязана к адресу | Этап 4 решает через агрегирующий view; в UI до этого показываем «You have N wallets, viewing 0xabc…». |
| Privy не поддерживает linkPhone в SDK миниапп Farcaster | Phone верификация только в браузере; в Farcaster показываем disabled с подсказкой. |

---

## 7. Что нужно от тебя сейчас

Подтверди один из вариантов первой итерации:
- **(А)** Делать сразу Шаги А+Б+В одним заходом (миграция + edge функции + UI).
- **(Б)** Только Шаг А (миграция + защита от hijack), потом обсудим UI.
- **(В)** Сначала прототип UI (Шаг В) на текущей схеме, без миграции — посмотрим, как чувствуется, потом переезжаем на новую модель.

И уточни: **верификация телефона** — оставляем Privy SMS (включён в их план) или хотим отдельный Twilio (даёт собственный sender ID, дороже)?
