# Round-Up Vault Smart Contracts

Упрощенная MVP версия для тестирования в Base Sepolia.

## Контракты

### 1. RoundUpVault.sol
Основной контракт для Round-Up функциональности:
- Принимает ETH от пользователей (spare change)
- Использует Chainlink для проверки цен ETH/USD
- Автоматически инвестирует через стратегии
- Поддерживает настройки пользователя (множитель, дневной лимит)

### 2. AaveStrategy.sol
Консервативная стратегия инвестирования:
- Конвертирует ETH → WETH → USDC
- Депозит USDC в Aave V3
- Получает доходность от Aave
- Поддерживает вывод средств

### 3. Интерфейсы
- `IInvestmentStrategy.sol` - интерфейс для всех стратегий
- `AggregatorV3Interface.sol` - интерфейс Chainlink Price Feed

## Адреса Base Sepolia

```
WETH: 0x4200000000000000000000000000000000000006
USDC: 0x036CbD53842c5426634e7929541eC2318f3dCF7e
Aave Pool: 0xA238Dd80C259a72e81d7e4664a9801593F98d1c5
DEX Router: 0x1689E7B1F10000AE47eBfE339a4f69dECd19F602
ETH/USD Price Feed: 0x1e6a7102e3A7A661D79E78028f8f2C86F76D0a94
```

## Порядок деплоя

1. **Деплой AaveStrategy**
   ```
   Constructor параметр: <адрес кошелька для тестов>
   ```
   Сохрани адрес задеплоенного AaveStrategy.

2. **Деплой RoundUpVault**
   ```
   Constructor параметр: <адрес AaveStrategy из шага 1>
   ```

3. **Update AaveStrategy owner**
   После деплоя RoundUpVault, обнови в AaveStrategy переменную `vault` на адрес RoundUpVault (если нужно).

## Тестирование

### 1. Инициализация пользователя
```solidity
roundUpVault.initializeSettings()
```

### 2. Выполнить Round-Up
```solidity
// Покупка на $9.50, round-up = $0.50
uint256 purchaseValue = 950000000; // $9.50 с 8 decimals
uint256 ethPrice = roundUpVault.getEthPrice(); // Получить текущую цену ETH

// Рассчитать сколько ETH нужно послать
uint256 roundUpUSD = roundUpVault.calculateRoundUp(purchaseValue);
uint256 ethToSend = (roundUpUSD * 1 ether) / ethPrice;

roundUpVault.roundUp{value: ethToSend}(purchaseValue)
```

### 3. Проверить баланс
```solidity
roundUpVault.getUserInvestmentValue(userAddress)
```

### 4. Вывести средства
```solidity
uint256 amountUSD = 500000; // $0.50 с 6 decimals
roundUpVault.withdraw(amountUSD)
```

## Известные ограничения MVP

1. Только одна стратегия (Aave Conservative)
2. Нет optimistic UI для отслеживания доходности в реальном времени
3. Упрощенный расчет slippage (2%)
4. Нет batching для газовой оптимизации
5. Withdrawal может иметь slippage при обмене обратно

## Безопасность

⚠️ Это MVP для тестирования. Перед production деплоем необходимо:
- Полный аудит кода
- Тестирование на больших суммах
- Добавить более сложную логику slippage protection
- Добавить pausable функциональность
- Добавить timelock для критичных функций
- Рассмотреть использование upgradeable паттерна

## Следующие шаги

После успешного деплоя:
1. Верифицируй контракты на Basescan
2. Предоставь адреса и ABI для интеграции с frontend
3. Создай тестовые транзакции
4. Проверь корректность начисления доходности в Aave
