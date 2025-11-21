# 🚀 Round-Up Strategies - Инструкция по Деплою

## 📋 Обзор

Мы деплоим 3 смарт-контракта на **Base Mainnet** в следующем порядке:

1. **AaveConservativeStrategy** (консервативная стратегия)
2. **LendingPlusStrategy** (средний риск)
3. **RoundUpVault** (основной контракт)

После деплоя необходимо связать стратегии с vault через `setVault()`.

---

## 🔧 Адреса Base Mainnet

### Основные токены и протоколы:

| Протокол/Токен | Адрес |
|----------------|-------|
| **WETH** | `0x4200000000000000000000000000000000000006` |
| **Chainlink ETH/USD Price Feed** | `0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70` |

### Aave V3 (Консервативная стратегия):

| Контракт | Адрес |
|----------|-------|
| **Aave Pool** | `0x403E5c3385731b53e83b4b57424682054A6B8B8f` |
| **aWETH Token** | `0x77c2250d4f6C76426C153f317A71887304192F13` |

### Compound V3 (Средний риск):

| Контракт | Адрес |
|----------|-------|
| **cWETHv3 Comet** | `0x46e6b214b524310239732D51387075E0e70970bf` |

---

## 📝 Шаг 1: Deploy AaveConservativeStrategy

### Параметры конструктора:
```
Нет параметров
```

### После деплоя:
Сохраните адрес: `AAVE_STRATEGY_ADDRESS`

---

## 📝 Шаг 2: Deploy LendingPlusStrategy

### Параметры конструктора:
```
Нет параметров
```

### После деплоя:
Сохраните адрес: `LENDING_PLUS_STRATEGY_ADDRESS`

---

## 📝 Шаг 3: Deploy RoundUpVault

### Параметры конструктора:
```solidity
address _ethPriceFeed = 0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70
address _strategy = AAVE_STRATEGY_ADDRESS (или LENDING_PLUS_STRATEGY_ADDRESS)
```

**Примечание:** Выберите одну из стратегий как основную. Позже можно переключить через `updateStrategy()`.

### После деплоя:
Сохраните адрес: `ROUND_UP_VAULT_ADDRESS`

---

## 🔗 Шаг 4: Связать Стратегии с Vault

### 4.1 Связать AaveConservativeStrategy:

Вызовите функцию `setVault()` на контракте **AaveConservativeStrategy**:

```solidity
function setVault(address _vault)
```

**Параметры:**
- `_vault`: `ROUND_UP_VAULT_ADDRESS`

**Важно:** Эту транзакцию может выполнить только `owner` (адрес, который задеплоил контракт).

---

### 4.2 Связать LendingPlusStrategy:

Вызовите функцию `setVault()` на контракте **LendingPlusStrategy**:

```solidity
function setVault(address _vault)
```

**Параметры:**
- `_vault`: `ROUND_UP_VAULT_ADDRESS`

**Важно:** Эту транзакцию может выполнить только `owner` (адрес, который задеплоил контракт).

---

## ✅ Шаг 5: Верификация Деплоя

### Проверьте следующее:

1. **AaveConservativeStrategy:**
   - ✅ `vault` установлен в `ROUND_UP_VAULT_ADDRESS`
   - ✅ `owner` установлен в ваш адрес

2. **LendingPlusStrategy:**
   - ✅ `vault` установлен в `ROUND_UP_VAULT_ADDRESS`
   - ✅ `owner` установлен в ваш адрес

3. **RoundUpVault:**
   - ✅ `strategy` установлена в `AAVE_STRATEGY_ADDRESS` или `LENDING_PLUS_STRATEGY_ADDRESS`
   - ✅ `owner` установлен в ваш адрес
   - ✅ ETH Price Feed работает (вызовите `getTokenPrice(0x0)`)

---

## 🎯 Шаг 6: Тестовые Транзакции

### 6.1 Инициализация настроек пользователя:

```solidity
RoundUpVault.initializeSettings()
```

### 6.2 Тестовый Round-Up:

```solidity
RoundUpVault.roundUp(340) payable
// Отправьте 0.01 ETH
// _primaryTxValueUSD = 340 ($3.40)
```

### 6.3 Проверка баланса:

```solidity
RoundUpVault.userBalances(YOUR_ADDRESS)
// Должен вернуть pendingRoundUp = 0.01 ETH
```

### 6.4 Тестовая инвестиция (если autoInvest = true):

Должна автоматически произойти, проверьте:

```solidity
RoundUpVault.userBalances(YOUR_ADDRESS).invested
// Должен быть > 0
```

### 6.5 Проверка стратегии:

**Для Aave:**
```solidity
AaveConservativeStrategy.userShares(YOUR_ADDRESS)
// Должно быть ≈ 0.01 ETH
```

**Для Compound:**
```solidity
LendingPlusStrategy.userShares(YOUR_ADDRESS)
// Должно быть ≈ 0.01 ETH
```

---

## 🔄 Переключение Стратегий (Опционально)

Если хотите переключить основную стратегию:

```solidity
RoundUpVault.updateStrategy(NEW_STRATEGY_ADDRESS)
```

**Важно:** Можно вызвать только `owner`.

---

## 🚨 Emergency Functions

### На случай проблем:

**RoundUpVault:**
```solidity
emergencyWithdraw() // Вывести весь ETH на owner
```

**AaveConservativeStrategy:**
```solidity
emergencyWithdraw() // Вывести весь ETH на owner
```

**LendingPlusStrategy:**
```solidity
emergencyWithdraw() // Вывести весь ETH на owner
```

---

## 📊 Итоговые Адреса (Заполните после деплоя)

```javascript
// Сохраните эти адреса для интеграции с фронтендом:

const CONTRACTS = {
  BASE_MAINNET: {
    // Стратегии
    AAVE_CONSERVATIVE_STRATEGY: "0x...", 
    LENDING_PLUS_STRATEGY: "0x...",
    
    // Основной контракт
    ROUND_UP_VAULT: "0x...",
    
    // Протоколы (для reference)
    WETH: "0x4200000000000000000000000000000000000006",
    AAVE_POOL: "0x403E5c3385731b53e83b4b57424682054A6B8B8f",
    COMPOUND_CWETH: "0x46e6b214b524310239732D51387075E0e70970bf",
    
    // Chainlink
    ETH_USD_PRICE_FEED: "0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70"
  }
};
```

---

## 🔐 Безопасность

1. ✅ Все контракты используют `onlyOwner` / `onlyVault` модификаторы
2. ✅ Approval токенов установлены правильно
3. ✅ Emergency withdraw функции защищены
4. ✅ Контракты проверены на reentrancy (используют `call` с проверками)

---

## 📱 Следующие Шаги

После успешного деплоя:

1. Создать конфигурационный файл `src/config/roundup.ts` с адресами и ABI
2. Разработать React хуки для взаимодействия с контрактами
3. Построить UI для Round-Up функциональности
4. Интегрировать с существующей системой loyalty tokens

---

## ❓ Troubleshooting

### Проблема: setVault() не работает
**Решение:** Убедитесь, что вызываете от адреса `owner` (который задеплоил контракт)

### Проблема: deposit() в стратегию не работает
**Решение:** Убедитесь, что `setVault()` был вызван успешно

### Проблема: Chainlink Price Feed возвращает 0
**Решение:** Проверьте, что используете правильный адрес Price Feed для Base mainnet

### Проблема: WETH wrap не работает
**Решение:** Убедитесь, что отправляете ETH вместе с транзакцией (payable)

---

## 📞 Поддержка

При возникновении проблем проверьте:
1. Логи транзакций в BaseScan
2. Балансы контрактов
3. Состояние approval токенов

---

✅ **Готово к деплою!**
