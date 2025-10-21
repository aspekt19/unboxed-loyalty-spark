# LoyalSparkERC20 - Документация Смарт-Контракта

## Обзор

LoyalSparkERC20 - расширенная реализация ERC20 токена с функциями управления программой лояльности, включая mint, burn, pause и статус активности.

**Официальный сайт проекта:** [https://loyalspark.online](https://loyalspark.online)

## Адреса Контрактов (Base Mainnet)

- **LoyalSparkERC20 (Implementation)**: `0xe6BA426C9c51281B929a17444De02c65815E27C3`
- **Chain ID**: `8453` (Base Mainnet)

---

## Стандартные ERC20 Функции

### `balanceOf(address account) → uint256` (view)

Возвращает баланс токенов на указанном адресе.

**Пример:**
```javascript
const balance = await tokenContract.balanceOf(userAddress);
```

### `transfer(address to, uint256 amount) → bool`

Переводит токены на указанный адрес.

**Пример:**
```javascript
await tokenContract.transfer(recipientAddress, ethers.parseUnits("10", 18));
```

### `approve(address spender, uint256 amount) → bool`

Разрешает указанному адресу тратить токены от имени владельца.

**Пример:**
```javascript
await tokenContract.approve(spenderAddress, ethers.parseUnits("100", 18));
```

### `allowance(address owner, address spender) → uint256` (view)

Возвращает количество токенов, которое `spender` может потратить от имени `owner`.

**Пример:**
```javascript
const allowance = await tokenContract.allowance(ownerAddress, spenderAddress);
```

### `transferFrom(address from, address to, uint256 amount) → bool`

Переводит токены от одного адреса другому (требуется предварительный `approve`).

**Пример:**
```javascript
await tokenContract.transferFrom(fromAddress, toAddress, ethers.parseUnits("50", 18));
```

### `name() → string` (view)

Возвращает название токена.

### `symbol() → string` (view)

Возвращает символ токена.

### `decimals() → uint8` (view)

Возвращает количество десятичных знаков (обычно 18).

### `totalSupply() → uint256` (view)

Возвращает общее количество выпущенных токенов.

---

## Расширенные Функции Управления

### `mint(address account, uint256 amount)`

Выпускает новые токены на указанный адрес.

**Ограничения:**
- Может вызываться только владельцем (мерчантом)
- Требуется активный статус минтинга (`isMintingActive == true`)

**Параметры:**
- `account` - Адрес получателя токенов
- `amount` - Количество токенов (в wei, т.е. с учетом 18 decimals)

**Пример:**
```javascript
// Выпустить 100 токенов
await tokenContract.mint(customerAddress, ethers.parseUnits("100", 18));
```

### `burn(address account, uint256 amount)`

Сжигает (уничтожает) токены с указанного адреса.

**Ограничения:**
- Может вызываться только владельцем (мерчантом)
- Не требует `approve` от держателя токенов

**Параметры:**
- `account` - Адрес, с которого сжигаются токены
- `amount` - Количество токенов для сжигания

**Использование:**
Используется при удалении программы лояльности для сжигания всех существующих токенов.

**Пример:**
```javascript
// Сжечь все токены пользователя
await tokenContract.burn(customerAddress, balance);
```

---

## Функции Управления Статусом

### `enableMinting()`

Включает возможность выпуска новых токенов.

**Ограничения:**
- Только владелец

**Пример:**
```javascript
await tokenContract.enableMinting();
```

### `disableMinting()`

Отключает возможность выпуска новых токенов.

**Ограничения:**
- Только владелец

**Пример:**
```javascript
await tokenContract.disableMinting();
```

### `pauseUtility()`

Приостанавливает использование токенов (переводы, активацию вознаграждений).

**Ограничения:**
- Только владелец

**Эффекты:**
- Все `transfer` и `transferFrom` будут отклонены
- Токены остаются на балансе, но не могут быть использованы

**Пример:**
```javascript
await tokenContract.pauseUtility();
```

### `unpauseUtility()`

Возобновляет использование токенов.

**Ограничения:**
- Только владелец

**Пример:**
```javascript
await tokenContract.unpauseUtility();
```

---

## Функции Просмотра Статуса

### `isMintingActive() → bool` (view)

Проверяет, активен ли минтинг токенов.

**Возвращает:**
- `true` - минтинг разрешен
- `false` - минтинг заблокирован

**Пример:**
```javascript
const isActive = await tokenContract.isMintingActive();
```

### `isUtilityActive() → bool` (view)

Проверяет, активно ли использование токенов (не на паузе).

**Возвращает:**
- `true` - токены можно переводить и использовать
- `false` - токены на паузе

**Пример:**
```javascript
const isActive = await tokenContract.isUtilityActive();
```

### `getMerchantAddress() → address` (view)

Возвращает адрес мерчанта-владельца программы.

**Пример:**
```javascript
const merchantAddress = await tokenContract.getMerchantAddress();
```

### `owner() → address` (view)

Возвращает адрес владельца контракта (обычно совпадает с мерчантом).

**Пример:**
```javascript
const owner = await tokenContract.owner();
```

---

## Жизненный Цикл Программы

### 1. Выпуск Токенов Клиентам

```javascript
// Мерчант выпускает токены клиенту
await loyaltyToken.mint(
  customerAddress,
  ethers.parseUnits("50", 18) // 50 токенов
);
```

### 2. Использование Токенов

```javascript
// Клиент переводит токены мерчанту для активации вознаграждения
await loyaltyToken.transfer(
  merchantAddress,
  ethers.parseUnits("10", 18) // 10 токенов за вознаграждение
);
```

### 3. Приостановка Программы

```javascript
// Мерчант временно приостанавливает программу
await loyaltyToken.pauseUtility();

// Проверка статуса
const isActive = await loyaltyToken.isUtilityActive(); // false
```

### 4. Возобновление Программы

```javascript
// Мерчант возобновляет программу
await loyaltyToken.unpauseUtility();
```

### 5. Удаление Программы

```javascript
// Получение всех держателей токенов
const holders = await getTokenHolders(tokenAddress);

// Сжигание токенов у всех держателей пакетами по 5
for (let i = 0; i < holders.length; i += 5) {
  const batch = holders.slice(i, i + 5);
  
  for (const holder of batch) {
    const balance = await loyaltyToken.balanceOf(holder.address);
    if (balance > 0) {
      await loyaltyToken.burn(holder.address, balance);
    }
  }
}
```

---

## Безопасность и Ограничения

### Контроль Доступа

- **Только владелец** может:
  - Выпускать токены (`mint`)
  - Сжигать токены (`burn`)
  - Включать/отключать минтинг
  - Приостанавливать/возобновлять использование

### Защита от Злоупотреблений

1. **Pause механизм**: Позволяет мерчанту мгновенно остановить все операции с токенами
2. **Burn без approve**: Мерчант может сжечь токены у любого держателя без предварительного разрешения (для закрытия программы)
3. **Disable minting**: Предотвращает выпуск новых токенов после завершения программы

### Статусы Программы

Программа может находиться в одном из состояний:

| Статус | isMintingActive | isUtilityActive | Описание |
|--------|----------------|-----------------|----------|
| **Активна** | ✅ true | ✅ true | Полностью рабочая программа |
| **На паузе** | ✅ true | ❌ false | Токены заморожены, минтинг возможен |
| **Закрыта** | ❌ false | ❌ false | Программа завершена |

---

## Интеграция с Frontend

### Подключение к Контракту

```javascript
import { CONTRACTS } from '@/config/contracts';
import { useWriteContract, useReadContract } from 'wagmi';

// Минтинг токенов
const { writeContract } = useWriteContract();

await writeContract({
  address: tokenAddress,
  abi: CONTRACTS.LOYAL_SPARK_ERC20.abi,
  functionName: 'mint',
  args: [recipientAddress, amount],
});
```

### Чтение Статуса

```javascript
// Проверка статуса программы
const { data: isActive } = useReadContract({
  address: tokenAddress,
  abi: CONTRACTS.LOYAL_SPARK_ERC20.abi,
  functionName: 'isUtilityActive',
});
```

### Управление Статусом

```javascript
// Пауза программы
await writeContract({
  address: tokenAddress,
  abi: CONTRACTS.LOYAL_SPARK_ERC20.abi,
  functionName: 'pauseUtility',
});

// Возобновление программы
await writeContract({
  address: tokenAddress,
  abi: CONTRACTS.LOYAL_SPARK_ERC20.abi,
  functionName: 'unpauseUtility',
});
```

---

## Часто Задаваемые Вопросы

### Можно ли восстановить сожженные токены?

Нет, сожженные токены удаляются навсегда и не могут быть восстановлены.

### Что происходит с токенами на паузе?

Токены остаются на балансе держателей, но не могут быть переведены или использованы до снятия паузы.

### Можно ли изменить владельца программы?

Да, используя стандартную функцию `transferOwnership` (если реализована в контракте).

### Можно ли использовать токены на DEX?

Да, токены полностью совместимы со стандартом ERC20 и могут торговаться на любых DEX (Uniswap, SushiSwap и т.д.).

### Что происходит при попытке transfer на паузе?

Транзакция будет отклонена с ошибкой, токены останутся на балансе отправителя.

---

## Поддержка

Для вопросов и поддержки:
- Официальный сайт: [https://loyalspark.online](https://loyalspark.online)
- Email: support@loyalspark.io

## Лицензия

MIT License - см. LICENSE файл для деталей.
