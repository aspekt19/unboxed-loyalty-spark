# LoyaltyTokenFactory - Документация Смарт-Контракта

## Обзор

LoyaltyTokenFactory - фабричный контракт для создания и управления токенами лояльности на блокчейне Base. Использует паттерн прокси для экономии газа при деплое новых программ.

**Официальный сайт проекта:** [https://loyalspark.online](https://loyalspark.online)

## Адреса Контрактов (Base Mainnet)

- **LoyaltyTokenFactory**: `0x5F3DdBa12580CFdc6016258774cCc19C4250dA80`
- **LoyalSparkERC20 (Implementation)**: `0xe6BA426C9c51281B929a17444De02c65815E27C3`
- **Chain ID**: `8453` (Base Mainnet)

---

## Основные Функции

### `createLoyaltyToken(string _name, string _symbol, address _merchantAddress) → address`

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

const receipt = await tx.wait();
const tokenAddress = receipt.logs[0].args.tokenAddress;
```

### `reactivateExistingToken(address _tokenProxyAddress)`

Реактивирует ранее созданный токен лояльности.

**Параметры:**
- `_tokenProxyAddress` - Адрес прокси-контракта токена

**События:**
- `LoyaltyTokenReactivated(address indexed tokenAddress, address indexed activatedBy, string message)`

**Пример использования:**
```javascript
await factoryContract.reactivateExistingToken(tokenProxyAddress);
```

### `tokenImplementation() → address` (view)

Возвращает адрес имплементации токена.

**Пример:**
```javascript
const implementationAddress = await factoryContract.tokenImplementation();
```

### `factoryAdmin() → address` (view)

Возвращает адрес администратора фабрики.

**Пример:**
```javascript
const adminAddress = await factoryContract.factoryAdmin();
```

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

### 2. Реактивация Существующей Программы

```javascript
// Мерчант реактивирует ранее созданную программу
await factoryContract.reactivateExistingToken(existingTokenAddress);
```

---

## События

### LoyaltyTokenCreated

Генерируется при создании нового токена лояльности.

**Параметры:**
- `tokenAddress` (indexed) - Адрес созданного токена
- `merchantAddress` (indexed) - Адрес мерчанта-владельца
- `name` - Название программы
- `symbol` - Символ токена

### LoyaltyTokenReactivated

Генерируется при реактивации токена.

**Параметры:**
- `tokenAddress` (indexed) - Адрес реактивированного токена
- `activatedBy` (indexed) - Адрес активировавшего
- `message` - Сообщение о реактивации

---

## Интеграция с Frontend

### Подключение к Контракту

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

### Получение Событий Создания

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

## Безопасность

### Контроль Доступа

- Только администратор фабрики может обновлять implementation контракт
- Каждый мерчант получает полный контроль над своим токеном лояльности
- Фабрика использует паттерн прокси для безопасного апгрейда

### Паттерн Прокси

Фабрика создает минимальные прокси-контракты, указывающие на единую имплементацию LoyalSparkERC20. Это позволяет:
- Экономить газ при создании новых программ
- Обновлять логику токенов без изменения адресов
- Изолировать состояние каждой программы

---

## Часто Задаваемые Вопросы

### Сколько стоит создание программы?

Стоимость зависит от цены газа в сети Base. Примерно 0.0001-0.001 ETH за транзакцию создания.

### Можно ли создать несколько программ одним мерчантом?

Да, один мерчант может создать неограниченное количество программ лояльности.

### Можно ли изменить implementation после создания токена?

Да, администратор фабрики может обновить implementation, и все существующие прокси автоматически будут использовать новую версию.

### Как проверить, что токен был создан через фабрику?

Можно проверить события `LoyaltyTokenCreated` или вызвать `tokenImplementation()` у прокси и сравнить с адресом из фабрики.

---

## Поддержка

Для вопросов и поддержки:
- Официальный сайт: [https://loyalspark.online](https://loyalspark.online)
- Email: support@loyalspark.io

## Лицензия

MIT License - см. LICENSE файл для деталей.
