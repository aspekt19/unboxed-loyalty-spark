
# План: Gasless-транзакции через Base Paymaster

## Цель
Дать пользователям возможность совершать onchain-действия (mint, transfer, redeem, P2P) **без ETH в кошельке** — газ оплачивает наш Coinbase Paymaster, а несколько действий можно объединять в одну подпись (EIP-7702 / batching).

## Технологический стек
- **Privy Smart Wallets** — поверх существующих Privy EOA. Smart Wallet = ERC-4337 аккаунт (Kernel/Coinbase Smart Account), к которому Privy EOA выступает signer'ом. Не ломает текущую аутентификацию.
- **Coinbase Developer Platform (CDP) Paymaster & Bundler** — единый RPC endpoint Base Mainnet, спонсирует UserOperations.
- **viem 2.x + permissionless.js** — уже частично есть в стеке (viem). Добавим `permissionless` для работы с UserOperations.
- **Base Mainnet (chainId 8453)** — основная сеть. Sepolia — для тестов.

## Архитектурная схема
```text
User clicks "Redeem"
   ↓
Privy EOA (signer)
   ↓
Smart Wallet (ERC-4337 account, owner = EOA)
   ↓  UserOperation
CDP Bundler  ──── verifyPaymaster ──→  CDP Paymaster
   ↓                                       │
EntryPoint v0.7 on Base                    │
   ↓                              gas paid by us
Loyalty contracts (existing)
```

## Этапы внедрения

### Этап 1. Подготовка инфраструктуры (без кода)
1. Зарегистрировать проект в CDP Portal → создать Paymaster & Bundler endpoint на Base Mainnet и Base Sepolia.
2. Завести **policy** в CDP: whitelist адресов наших контрактов (LoyaltyTokenFactory `0x5F3...A80`, Logic `0xe6B...7C3`, Escrow, P2P-маркетплейс) и whitelist методов (`redeem`, `transfer`, `mint`, `createOffer`, `acceptOffer`).
3. Установить лимиты: max gas per user/day, max global spend per day (защита от слива баланса).
4. Пополнить Paymaster в USDC/ETH на CDP.
5. Завести секреты в Lovable Cloud: `CDP_PAYMASTER_URL`, `CDP_BUNDLER_URL`, `CDP_PAYMASTER_API_KEY` (если требуется).

### Этап 2. Privy Smart Wallets (feature flag, off by default)
1. Включить Smart Wallets в Privy Dashboard (тип: Coinbase Smart Wallet или Kernel; рекомендую Coinbase — нативная поддержка EIP-7702 на Base).
2. Обновить `PrivyProvider` конфигом `smartWallets: { defaultChain: base, paymasterContext, bundlerUrl }`.
3. В `AuthContext` добавить экспозицию `smartWalletAddress` рядом с EOA `address`. Сохранить EOA как primary (back-compat), Smart Wallet — как новый "execution wallet" под feature flag `VITE_GASLESS_ENABLED`.
4. Миграция привязки: для существующих пользователей Smart Wallet создаётся детерминированно от EOA — адрес стабильный.

### Этап 3. Абстракция отправки транзакций
1. Создать `src/lib/web3/sendTx.ts` — единая точка отправки:
   - если `gaslessEnabled && smartWalletReady` → `smartWalletClient.sendUserOperation({ calls, paymaster, bundler })`
   - иначе → текущий `walletClient.sendTransaction` (fallback).
2. Поддержать **batching**: `calls: [{ to, data, value }, ...]` — например `approve + transferFrom` или `redeem + claimReward` одним кликом/подписью.
3. Сохранить правило из памяти: вызов `sendTx` остаётся **синхронным к клику** пользователя (без `await` перед ним), чтобы Safari/iOS не блокировал popup Privy.
4. Логирование: пишем `userOpHash` и финальный `txHash` в `transactions` таблицу, чтобы аналитика и Builder Code трекинг продолжали работать.

### Этап 4. Builder Code совместимость
1. CDP Paymaster поддерживает append calldata suffix. Проверить, что наш фиксированный 29-байтный Builder Code suffix (`62635f...`) корректно приклеивается к **последнему** call в batch, а не теряется.
2. Если CDP не сохраняет suffix внутри batched call — добавить его в каждый под-call вручную через враппер.
3. Покрыть тестом `tests/builder-code-coverage.test.ts`.

### Этап 5. Миграция фич (пошагово, по одной)
По одной фиче, чтобы не сломать существующий flow:
1. **Voucher Redeem** (Shopper) — простейший, один call, идеален для первого релиза.
2. **P2P offer accept** — два call'а в одном (transfer токена + расчёт ETH), демонстрирует batching.
3. **Mint loyalty tokens** (Merchant) — высокочастотный, экономит газ мерчантам.
4. **Gift certificates batch (до 100)** — самая большая экономия UX: одна подпись вместо 100.
5. **Escrow создание/раскрытие**.

Для каждой фичи: feature flag → канарейка (5% юзеров) → 100%.

### Этап 6. Мониторинг и контроль расходов
1. Дашборд в `AdminPage`: USD потрачено за день/неделю, топ-N юзеров по газу, отказы Paymaster.
2. Edge function `paymaster-policy-check` (опционально): pre-flight валидация UserOp до отправки в bundler, чтобы давать осмысленный UX error до подписи.
3. Алерты: если daily spend > 80% от лимита → Slack/email админу.
4. Anti-abuse: rate-limit на уровне нашего бэкенда — N UserOps в час на `user_id`, плюс минимальный age аккаунта (24ч) перед первым gasless action.

### Этап 7. EIP-7702 (опционально, после стабилизации 4337)
Когда CDP Paymaster добавит полную поддержку 7702 на Base Mainnet — позволить EOA пользователям "временно стать" Smart Account без миграции адреса. Это убирает необходимость в отдельном Smart Wallet адресе и решает back-compat полностью.

## Технические детали

### Зависимости
```
bun add permissionless@^0.2 @privy-io/server-auth
# viem уже стоит
```

### Конфиг Smart Wallet (пример shape)
```ts
// src/lib/web3/smartWallet.ts
const paymasterClient = createPaymasterClient({ transport: http(CDP_PAYMASTER_URL) });
const bundlerClient = createBundlerClient({ chain: base, transport: http(CDP_BUNDLER_URL), paymaster: paymasterClient });
```

### Контракты — изменения НЕ требуются
Существующие loyalty/escrow контракты совместимы с ERC-4337 как есть: они видят `msg.sender = Smart Wallet`, а не EOA. **Важно**: проверить все `onlyOwner` / `MINTER_ROLE` записи в БД — если где-то роль выдана на EOA, нужно либо перевыдать на Smart Wallet, либо в has_role проверять оба адреса.

### RLS-импликации
`active-primary-wallet` логика остаётся: пользователь видит и EOA, и Smart Wallet в списке кошельков. RLS-политики уже используют `lower(wallet_address)` — добавим Smart Wallet адрес в `user_wallets` при первой инициализации.

### Agent (CDP MPC) wallets
AI-агенты используют CDP MPC и платят газ из своего баланса. Paymaster их **не** покрывает на старте (другой биллинг-домен — у них своя экономика через A2A revenue model). Можно подключить позже отдельной policy.

## Риски и mitigations
| Риск | Mitigation |
|---|---|
| Слив Paymaster-баланса при abuse | CDP policy whitelist + rate-limit + дневной cap |
| Smart Wallet ≠ EOA, ломает существующие onchain rep/балансы | Feature flag, постепенный rollout, отображение обоих адресов в UI, миграционный гайд |
| Popup-блокировка из-за async подписи | Жёсткое правило sync-to-click сохранено (memory: wallet-transaction-gestures) |
| Builder Code attribution теряется в batch | Покрыть тестом, при необходимости — врапнуть каждый under-call |
| CDP даун | Fallback на обычные транзакции с EOA — пользователь платит газ сам, но flow не ломается |
| MINTER_ROLE привязан к EOA | Скрипт миграции ролей через Edge Function `grant-minter-to-smart-wallet` |

## Сроки (оценка)
- Этап 1–2: 1-2 дня
- Этап 3–4: 2-3 дня
- Этап 5 (по фиче): ~1 день на фичу × 5 = ~5 дней с канарейкой
- Этап 6: 1-2 дня
- **Итого до прод-релиза первой фичи (Voucher Redeem)**: ~5-7 дней работы.

## Что НЕ входит в этот план
- EIP-7702 нативный (без 4337) — отложено до этапа 7.
- Гасless для AI-агентов — отдельный трек.
- Замена Privy на другой auth provider.
- Смена контрактов / новые деплои.

## Критерии готовности
- [ ] Юзер без ETH успешно redeem'ит voucher на Base Mainnet.
- [ ] В Basescan видно `UserOperationEvent`, газ оплачен с адреса Paymaster.
- [ ] Builder Code suffix присутствует в финальном calldata.
- [ ] Daily spend < установленного лимита.
- [ ] Fallback на обычную транзакцию работает при отключении flag.
- [ ] Существующие EOA-флоу не сломаны (regression-тесты проходят).
