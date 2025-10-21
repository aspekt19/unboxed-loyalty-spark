# Loyal Spark - Документация Смарт-Контрактов

## Обзор

Loyal Spark использует систему смарт-контрактов на блокчейне Base для управления программами лояльности. Архитектура состоит из двух основных контрактов:

1. **LoyaltyTokenFactory** - Фабрика для создания новых токенов лояльности
2. **LoyalSparkERC20** - Реализация токена лояльности с расширенной функциональностью

## Адреса Контрактов (Base Mainnet)

- **LoyaltyTokenFactory**: `0x5F3DdBa12580CFdc6016258774cCc19C4250dA80`
- **LoyalSparkERC20 (Implementation)**: `0xe6BA426C9c51281B929a17444De02c65815E27C3`
- **Chain ID**: `8453` (Base Mainnet)

---

## 1. LoyaltyTokenFactory

### Описание

Фабричный контракт, отвечающий за создание и управление токенами лояльности. Использует паттерн прокси для экономии газа при деплое новых программ.

### Основные Функции

#### `createLoyaltyToken(string _name, string _symbol, address _merchantAddress) → address`

Создает новый токен лояльности для мерчанта.

**Параметры:**
- `_name` - Название программы лояльности (например, "FREE POPCORN")
- `_symbol` - Символ токена (например, "POP")
- `_merchantAddress` - Адрес кошелька мерчанта-владельца

**Возвращает:**
- Адрес нового прокси-контракта токена

**События:**
- `LoyaltyTokenCreated(address indexed tokenAddress, address indexed merchantAddress, string name, string symbol)`

**Пример использования:**
```javascript
const tx = await factoryContract.createLoyaltyToken(
  "Cinema Rewards",
  "CINEMA",
  merchantAddress
);
```

#### `reactivateExistingToken(address _tokenProxyAddress)`

Реактивирует ранее созданный токен лояльности.

**Параметры:**
- `_tokenProxyAddress` - Адрес прокси-контракта токена

**События:**
- `LoyaltyTokenReactivated(address indexed tokenAddress, address indexed activatedBy, string message)`

#### `tokenImplementation() → address` (view)

Возвращает адрес имплементации токена.

#### `factoryAdmin() → address` (view)

Возвращает адрес администратора фабрики.

---

## 2. LoyalSparkERC20

### Описание

Расширенная реализация ERC20 токена с функциями управления программой лояльности, включая mint, burn, pause и статус активности.

### Стандартные ERC20 Функции

#### `balanceOf(address account) → uint256` (view)
Возвращает баланс токенов на указанном адресе.

#### `transfer(address to, uint256 amount) → bool`
Переводит токены на указанный адрес.

#### `approve(address spender, uint256 amount) → bool`
Разрешает указанному адресу тратить токены от имени владельца.

#### `allowance(address owner, address spender) → uint256` (view)
Возвращает количество токенов, которое `spender` может потратить от имени `owner`.

#### `transferFrom(address from, address to, uint256 amount) → bool`
Переводит токены от одного адреса другому (требуется предварительный `approve`).

#### `name() → string` (view)
Возвращает название токена.

#### `symbol() → string` (view)
Возвращает символ токена.

#### `decimals() → uint8` (view)
Возвращает количество десятичных знаков (обычно 18).

#### `totalSupply() → uint256` (view)
Возвращает общее количество выпущенных токенов.

### Расширенные Функции Управления

#### `mint(address account, uint256 amount)`

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

#### `burn(address account, uint256 amount)`

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

### Функции Управления Статусом

#### `enableMinting()`

Включает возможность выпуска новых токенов.

**Ограничения:**
- Только владелец

#### `disableMinting()`

Отключает возможность выпуска новых токенов.

**Ограничения:**
- Только владелец

#### `pauseUtility()`

Приостанавливает использование токенов (переводы, активацию вознаграждений).

**Ограничения:**
- Только владелец

**Эффекты:**
- Все `transfer` и `transferFrom` будут отклонены
- Токены остаются на балансе, но не могут быть использованы

#### `unpauseUtility()`

Возобновляет использование токенов.

**Ограничения:**
- Только владелец

### Функции Просмотра Статуса

#### `isMintingActive() → bool` (view)

Проверяет, активен ли минтинг токенов.

**Возвращает:**
- `true` - минтинг разрешен
- `false` - минтинг заблокирован

#### `isUtilityActive() → bool` (view)

Проверяет, активно ли использование токенов (не на паузе).

**Возвращает:**
- `true` - токены можно переводить и использовать
- `false` - токены на паузе

#### `getMerchantAddress() → address` (view)

Возвращает адрес мерчанта-владельца программы.

#### `owner() → address` (view)

Возвращает адрес владельца контракта (обычно совпадает с мерчантом).

---

## Жизненный Цикл Программы Лояльности

### 1. Создание Программы

```javascript
// Мерчант создает программу через фабрику
const tx = await factoryContract.createLoyaltyToken(
  "Summer Promo",
  "SUMMER",
  merchantWallet
);

const receipt = await tx.wait();
const tokenAddress = receipt.logs[0].args.tokenAddress;
```

### 2. Выпуск Токенов Клиентам

```javascript
// Мерчант выпускает токены клиенту
await loyaltyToken.mint(
  customerAddress,
  ethers.parseUnits("50", 18) // 50 токенов
);
```

### 3. Использование Токенов

```javascript
// Клиент переводит токены мерчанту для активации вознаграждения
await loyaltyToken.transfer(
  merchantAddress,
  ethers.parseUnits("10", 18) // 10 токенов за вознаграждение
);
```

### 4. Приостановка Программы

```javascript
// Мерчант временно приостанавливает программу
await loyaltyToken.pauseUtility();

// Проверка статуса
const isActive = await loyaltyToken.isUtilityActive(); // false
```

### 5. Возобновление Программы

```javascript
// Мерчант возобновляет программу
await loyaltyToken.unpauseUtility();
```

### 6. Удаление Программы

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

### Подключение к Контрактам

```javascript
import { CONTRACTS } from '@/config/contracts';
import { useWriteContract, useReadContract } from 'wagmi';

// Создание программы
const { writeContract } = useWriteContract();

await writeContract({
  address: CONTRACTS.LOYALTY_TOKEN_FACTORY.address,
  abi: CONTRACTS.LOYALTY_TOKEN_FACTORY.abi,
  functionName: 'createLoyaltyToken',
  args: [name, symbol, merchantAddress],
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

### События и Логи

```javascript
// Получение истории создания токенов
const logs = await publicClient.getLogs({
  address: CONTRACTS.LOYALTY_TOKEN_FACTORY.address,
  event: {
    type: 'event',
    name: 'LoyaltyTokenCreated',
    inputs: [
      { indexed: true, name: 'tokenAddress', type: 'address' },
      { indexed: true, name: 'merchantAddress', type: 'address' },
      { indexed: false, name: 'name', type: 'string' },
      { indexed: false, name: 'symbol', type: 'string' },
    ],
  },
  fromBlock: startBlock,
  toBlock: 'latest',
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

### Сколько стоит создание программы?

Стоимость зависит от цены газа в сети Base. Примерно 0.0001-0.001 ETH за транзакцию создания.

### Можно ли использовать токены на DEX?

Да, токены полностью совместимы со стандартом ERC20 и могут торговаться на любых DEX (Uniswap, SushiSwap и т.д.).

---

## Поддержка

Для вопросов и поддержки:
- GitHub: [Loyal Spark Repository]
- Email: support@loyalspark.io
- Discord: [Community Server]

## Лицензия

MIT License - см. LICENSE файл для деталей.
