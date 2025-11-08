# RoundUpVault Deployment Guide

## Обновления в контракте v2

### ✅ Убраны все ограничения:
- ❌ `MIN_ROUND_UP` - теперь можно отправлять любую сумму
- ❌ `MAX_DAILY_ROUND_UP` - нет дневного лимита
- ❌ `dailyLimit` - полностью убран механизм лимитов

### ✅ Добавлена поддержка любых токенов:
- 🪙 **ETH** (нативный токен) - поддерживается по умолчанию
- 🪙 **ERC20 токены** - можно добавить любой токен с Chainlink price feed
- 📊 Автоматическое получение цен через Chainlink Oracle
- 💰 Функции для round-up токенов: `roundUpToken()`
- 💸 Функции для вывода токенов: `withdrawToken()`

### ⭐ НОВАЯ ФУНКЦИЯ: One-Transaction Round-Up
- 🚀 **`roundUpWithTransfer()`** - одна транзакция для всего!
  - Автоматически отправляет основную сумму получателю
  - Автоматически отправляет round-up в контракт для инвестирования
  - **Намного удобнее** чем две отдельные транзакции
  - Экономит gas и время

## Шаги для деплоя

### 1. Подготовка

Вам нужны:
- MetaMask с ETH на Base Sepolia
- Адрес Chainlink ETH/USD Price Feed на Base Sepolia: `0x4aDC67696bA383F43DD60A9e78F2C97Fbbfc7cb1`
- Адрес AaveStrategy контракта (если используете)

### 2. Деплой контракта

**Используйте файл:** `contracts/RoundUpVault_deploy.sol`

**Constructor параметры:**
```solidity
constructor(
    address _ethPriceFeed,  // 0x4aDC67696bA383F43DD60A9e78F2C97Fbbfc7cb1 для Base Sepolia
    address _strategy       // Адрес вашего AaveStrategy контракта
)
```

**Пример через Remix:**
1. Откройте [Remix IDE](https://remix.ethereum.org/)
2. Создайте новый файл `RoundUpVault.sol`
3. Скопируйте содержимое из `contracts/RoundUpVault_deploy.sol`
4. Скомпилируйте (Solidity 0.8.20)
5. Deploy с параметрами:
   - `_ethPriceFeed`: `0x4aDC67696bA383F43DD60A9e78F2C97Fbbfc7cb1`
   - `_strategy`: адрес вашего AaveStrategy

### 3. После деплоя

Скопируйте адрес нового контракта и обновите в проекте:

**Файл:** `src/config/roundup.ts`
```typescript
export const ROUND_UP_CONFIG = {
  VAULT_ADDRESS: '0xВАШ_НОВЫЙ_АДРЕС_КОНТРАКТА',
  // ... остальные настройки
}
```

### 4. Добавление поддержки токенов (опционально)

Чтобы добавить поддержку ERC20 токена:

```solidity
// Вызовите функцию addSupportedToken (только owner)
vault.addSupportedToken(
    tokenAddress,     // Адрес ERC20 токена
    priceFeedAddress  // Chainlink Price Feed для токена
);
```

**Chainlink Price Feeds на Base Sepolia:**
- USDC/USD: `0xd30e2101a97dcbAeBCBC04F14C3f624E67A35165`
- LINK/USD: `0xb113F5A928BCfF189C998ab20d753a47F9dE5A61`
- [Полный список](https://docs.chain.link/data-feeds/price-feeds/addresses?network=base&page=1#base-sepolia-testnet)

## Примеры использования

### ⭐ ONE-TRANSACTION Round-up (РЕКОМЕНДУЕТСЯ)
```typescript
// Одна транзакция для всего!
await writeContract({
  address: VAULT_ADDRESS,
  abi: VAULT_ABI,
  functionName: 'roundUpWithTransfer',
  args: [
    recipientAddress,      // Кому отправить основную сумму
    primaryAmountWei,      // Основная сумма в wei
    usdAmountScaled        // USD для статистики (scaled by 100)
  ],
  value: totalValueWei     // Полная сумма (primary + roundUp)
});
```

**Преимущества:**
- ✅ Одна транзакция вместо двух
- ✅ Меньше gas fees
- ✅ Автоматическое разделение платежа
- ✅ Проще в использовании

### Round-up только в контракт (как раньше)
```typescript
await writeContract({
  address: VAULT_ADDRESS,
  abi: VAULT_ABI,
  functionName: 'roundUp',
  args: [usdAmountScaled],
  value: roundUpValueWei
});
```

### Round-up ERC20 токенов (новая функция)
```typescript
// 1. Approve токены для контракта
await writeContract({
  address: TOKEN_ADDRESS,
  abi: ERC20_ABI,
  functionName: 'approve',
  args: [VAULT_ADDRESS, roundUpAmount]
});

// 2. Round-up токенов
await writeContract({
  address: VAULT_ADDRESS,
  abi: VAULT_ABI,
  functionName: 'roundUpToken',
  args: [TOKEN_ADDRESS, roundUpAmount, primaryTxValueUSD]
});
```

## Что изменилось в ABI

Добавлены новые функции:
- **`roundUpWithTransfer(address recipient, uint256 primaryAmount, uint256 primaryTxValueUSD)`** ⭐ НОВОЕ - одна транзакция для всего
- `addSupportedToken(address token, address priceFeed)` - добавить токен
- `removeSupportedToken(address token)` - удалить токен
- `roundUpToken(address token, uint256 amount, uint256 primaryTxValueUSD)` - round-up токенов
- `withdrawToken(address token, uint256 amount)` - вывод токенов
- `getTokenPrice(address token)` - получить цену токена
- `calculateRoundUp(address token, uint256 amount)` - рассчитать round-up
- `getUserTokenBalance(address user, address token)` - баланс токенов пользователя

## Важно!

⚠️ **После деплоя обязательно обновите:**
1. `VAULT_ADDRESS` в `src/config/roundup.ts`
2. `ROUND_UP_VAULT_ABI` с новыми функциями (экспортируйте из Remix)
3. Убедитесь что AaveStrategy задеплоен и его адрес корректен

## Тестирование

После деплоя:
1. Откройте `/roundup-test` в приложении
2. Попробуйте отправить round-up (любую сумму, ограничений нет!)
3. Проверьте что транзакция прошла успешно
4. Проверьте баланс в контракте

---

**Network:** Base Sepolia  
**Explorer:** https://sepolia.basescan.org/
