## Цель

Все **новые** программы лояльности выпускаются как **B20 Asset** (нативный precompile Base), **старые ERC-20** программы продолжают работать без изменений. x402, MCP, REST, escrow, vouchers — работают одинаково для обоих типов.

Ключевой факт: **B20 — это superset ERC-20**. `balanceOf`, `transfer`, `approve`, `transferFrom`, `allowance`, `mint(address,uint256)` — совпадают побайтно. Разница только в **деплое** (B20 Factory precompile вместо нашего `LoyaltyTokenFactory`) и в **активации** (не нужны `unpauseUtility` + `enableMinting` — B20 стартует активным, `MINT_ROLE` выдаётся в `initCalls` в той же tx).

---

## Архитектурная стратегия: `token_standard` per program

Единственный источник правды — новая колонка `loyalty_programs.token_standard` со значениями `erc20` (legacy) и `b20` (default для новых). Всё остальное — маршрутизация по этому полю.

```
loyalty_programs
├─ token_standard='erc20'  → старый путь (LoyaltyTokenFactory + unpause + enableMinting)
└─ token_standard='b20'    → новый путь (B20 Factory precompile, 1 tx на деплой)
                              общий ERC-20 путь для mint/transfer/burn/approve
```

Все read-операции (balances, transfers history, escrow, x402 settle, vouchers) идут через ERC-20 ABI и работают **идентично** для обоих. Разветвление — только на 2 операциях: `createProgram` и `activateProgram`.

---

## Изменения по слоям

### 1. БД (одна миграция)
- `ALTER TABLE loyalty_programs ADD COLUMN token_standard text NOT NULL DEFAULT 'b20' CHECK (token_standard IN ('erc20','b20'))`
- Backfill: все существующие → `'erc20'`, потом ставим `DEFAULT 'b20'`.
- Индекс на `token_standard` (для фильтров в аналитике).

### 2. Конфиг контрактов (`src/config/contracts.ts`)
- Добавить `B20_FACTORY = 0xB20f000000000000000000000000000000000000` (mainnet Base).
- Добавить `B20Constants.MINT_ROLE` (keccak константа) и минимальный ABI B20Factory: `createB20(uint8,bytes32,bytes,bytes[])`.
- Оставить `LOYALTY_TOKEN_FACTORY` и весь LOYAL_SPARK_ERC20 ABI как есть — legacy read/write путь.

### 3. Каноническое кодирование B20 params/initCalls
Precompile жёстко валидирует ABI (`AbiDecodeFailed`). Реализуем helpers на TypeScript (frontend) и на Deno (edge functions) — оба совместимы с `B20FactoryLib`:
- `encodeAssetCreateParams(name, symbol, admin, decimals=18)` → `abi.encode(string,string,address,uint8)`
- `encodeGrantRole(role, account)` → селектор `grantRole(bytes32,address)` + аргументы
- `encodeCreateB20(salt, params, initCalls[])` → полный calldata к factory, **плюс** append `BUILDER_SUFFIX` (сохраняем атрибуцию `bc_wdmnog7m`).
- Используем `viem` `encodeAbiParameters` / `encodeFunctionData` — они дают каноническое ABI.

Файлы:
- `src/config/b20.ts` (frontend, viem)
- `supabase/functions/_shared/b20-encoding.ts` (Deno, viem через `npm:viem`)

### 4. Frontend — новый хук деплоя
- `src/hooks/useDeployB20Token.ts`:
  - Синхронный `sendTransaction` к `B20_FACTORY` с одной tx: create + grantRole(MINT_ROLE, merchant) + (опц.) supply cap в `initCalls`.
  - Извлекаем адрес токена из логов B20 Factory (event `B20Created(address,...)`).
  - Сохраняем в БД с `token_standard='b20'`.
- `CreateLoyaltyProgram.tsx`: по умолчанию использует новый хук. Никакого UI-переключателя (пользователь просил "все новые = B20"). Одна tx вместо трёх → активационное окно/шаги убраны для B20.
- `ProgramActivationNote.tsx`, `useCheckProgramStatus`, `useToggleProgramStatus`: показывать/выполнять `unpause/enableMinting` только когда `token_standard === 'erc20'`. Для `b20` — скрыть блок активации, статус всегда `active` после деплоя.
- `useMintTokens`, `useTransferTokens`, `useBurnTokens`, `useApproveTokens`, `useTokenBalance`, `useMultiTokenBalance`: **не трогаем** — ERC-20 ABI работает для обоих.

### 5. Edge functions
- `supabase/functions/agent-prepare/index.ts`:
  - `create-program`: если запрос помечен `standard: 'b20'` (default true для новых) → возвращает calldata B20 Factory (одна tx). Иначе — старый путь.
  - `activate-program`: если программа `b20` → возвращает 200 с `already_active: true, transactions: []`. Иначе — существующий двухшаговый ответ.
  - `mint`, `transfer`, `recipient-transfer`, `recipient-approve`: **без изменений** — тот же ERC-20 ABI, тот же `builder_code`.
- `supabase/functions/loyalty-mcp` + `recipient-loyalty-mcp`:
  - `create_loyalty_program` (merchant MCP) → B20 calldata по умолчанию, флаг `use_legacy_erc20:true` даёт старый путь на всякий случай.
  - `activate_loyalty_program` → возвращает "no-op, B20 auto-active" для B20 программ.
  - `register_loyalty_program` → принимает и сохраняет `token_standard`.
  - Все остальные tools остаются как есть (mint/transfer/redeem/vouchers/p2p — работают через ERC-20 интерфейс).
- `agent-api/index.ts` (REST): те же правки, что и в MCP — `POST /programs`, `/activate-program`, `/program-status`, `/register-program`.

### 6. x402 / MCP-платный корридор
**Ничего не меняем**: x402 gateway не зависит от token_standard. Он маршрутизирует по URL (`/mcp-tools/<tool>`, `/recipient-mcp-tools/<tool>`), settle идёт через USDC, а вызываемые tools после оплаты используют тот же ERC-20 путь. Bazaar extensions уже исправлены прошлыми правками.

### 7. Escrow (`LoyaltyTokenEscrow.sol`)
Работает через стандартный ERC-20 (`transferFrom` + `approve`). B20 совместим побайтно → **никаких изменений**. `useApproveAndTransfer`, marketplace `create_p2p_offer` / `accept_p2p_offer` — работают.

### 8. Индексация (`sync-mint-history`, `useTokenStats`)
- `Transfer(address,address,uint256)` event сигнатура одинаковая для ERC-20 и B20.
- Но у B20 источник события — precompile-адрес токена (`0xB200...`), не наш логический контракт. Проверить, что `useTokenStats` фильтрует `logs` по `address === token.address` (уже так и делает).
- `sync-mint-history`: убедиться, что запросы по адресу токена работают для B20 (viem `getLogs` на mainnet Base поддерживает precompile-адреса — они появляются как обычные event emitters).

### 9. UI мелочи
- `ProgramStatusBadge`: для B20 не показывать "paused / minting disabled" — этих состояний нет.
- `ExtendProgramDialog`: expiration_days у нас логическое поле в БД → работает без изменений.
- `CreatedPrograms`, `TokenList`: добавить маленький бейдж "B20" рядом с новыми программами (визуальная информация, без функционала).

### 10. Документация
- `public/.well-known/skills/01-create-loyalty-program.md`: обновить flow — для новых программ теперь 1 tx вместо 3, шаги активации помечены как legacy.
- `skills/loyal-spark/references/calldata-flow.md`: добавить секцию B20.
- `docs/agents/QUICKSTART.md`: короткая пометка "programs are now B20 by default".
- Обновить mem://architecture с новым `token_standard` разветвлением.

---

## План выкатки

1. **Миграция БД** + бекфилл `token_standard='erc20'` для существующих строк.
2. Мержим B20 encoding helpers (frontend + edge).
3. Обновляем `agent-prepare`, `loyalty-mcp`, `recipient-loyalty-mcp`, `agent-api` (маршрутизация по `token_standard`).
4. Обновляем `CreateLoyaltyProgram` + новый `useDeployB20Token` → все новые деплои идут через B20.
5. Проверка: старая программа (`erc20`) — mint/transfer/redeem/x402 работают. Новая программа (`b20`) — деплой в 1 tx, mint работает сразу, transfer/redeem/escrow/x402 работают.

## Технические детали

- **B20 Factory**: `0xB20f000000000000000000000000000000000000` (одинаковый на всех сетях Base).
- **Variant enum**: `ASSET=0`, `STABLECOIN=1`. Используем `ASSET`.
- **Decimals**: фиксируем 18 (текущий формат Loyal Spark).
- **Salt**: `keccak256(abi.encode(merchant, name, symbol, blockTimestamp))` — детерминизм + защита от `TokenAlreadyExists`.
- **Supply cap**: пропускаем (или ставим `type(uint128).max`) — токены лояльности часто без cap.
- **Builder Code**: `BUILDER_SUFFIX` (`bc_wdmnog7m`) добавляется к calldata createB20 так же, как ко всем нашим write-tx.
- **Precompile нюанс**: fork-simulation в Tenderly не работает. Тестируем только на mainnet (dry probes на small salt) или base-anvil локально — не блокер для прода.

## Что НЕ меняется

- Кошельки пользователей, Privy, CDP MPC, SIWE, `lsk_`/`rwk_` ключи.
- ERC-20 ABI везде: балансы, переводы, allowances, indexing.
- x402 gateway, Bazaar discovery, MCP transport.
- Escrow контракт и весь marketplace flow.
- Vouchers, verify-voucher, rewards, tiers, referrals, gift-certificates.
- Все существующие программы продолжат работать через ERC-20 путь до конца жизни.
