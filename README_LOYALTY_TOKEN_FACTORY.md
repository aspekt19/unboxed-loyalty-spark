# LoyaltyTokenFactory - Smart Contract Documentation

## Overview

LoyaltyTokenFactory is a factory contract for creating and managing loyalty tokens on the Base blockchain. It uses the proxy pattern to save gas when deploying new programs.

**Official project website:** [https://loyalspark.online](https://loyalspark.online)

## Contract Addresses (Base Mainnet)

- **LoyaltyTokenFactory**: `0x5F3DdBa12580CFdc6016258774cCc19C4250dA80`
- **LoyalSparkERC20 (Implementation)**: `0xe6BA426C9c51281B929a17444De02c65815E27C3`
- **Chain ID**: `8453` (Base Mainnet)

---

## Main Functions

### `createLoyaltyToken(string _name, string _symbol, address _merchantAddress) → address`

Creates a new loyalty token for a merchant.

**Parameters:**
- `_name` - Loyalty program name (e.g., "FREE POPCORN")
- `_symbol` - Token symbol (e.g., "POP")
- `_merchantAddress` - Merchant owner wallet address

**Returns:**
- Address of the new token proxy contract

**Events:**
- `LoyaltyTokenCreated(address indexed tokenAddress, address indexed merchantAddress, string name, string symbol)`

**Usage Example:**
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

Reactivates a previously created loyalty token.

**Parameters:**
- `_tokenProxyAddress` - Token proxy contract address

**Events:**
- `LoyaltyTokenReactivated(address indexed tokenAddress, address indexed activatedBy, string message)`

**Usage Example:**
```javascript
await factoryContract.reactivateExistingToken(tokenProxyAddress);
```

### `tokenImplementation() → address` (view)

Returns the token implementation address.

**Example:**
```javascript
const implementationAddress = await factoryContract.tokenImplementation();
```

### `factoryAdmin() → address` (view)

Returns the factory administrator address.

**Example:**
```javascript
const adminAddress = await factoryContract.factoryAdmin();
```

---

## Loyalty Program Lifecycle

### 1. Creating a Program

```javascript
// Merchant creates a program through the factory
const tx = await factoryContract.createLoyaltyToken(
  "Summer Promo",
  "SUMMER",
  merchantWallet
);

const receipt = await tx.wait();
const tokenAddress = receipt.logs[0].args.tokenAddress;
```

### 2. Reactivating an Existing Program

```javascript
// Merchant reactivates a previously created program
await factoryContract.reactivateExistingToken(existingTokenAddress);
```

---

## Events

### LoyaltyTokenCreated

Emitted when a new loyalty token is created.

**Parameters:**
- `tokenAddress` (indexed) - Address of the created token
- `merchantAddress` (indexed) - Merchant owner address
- `name` - Program name
- `symbol` - Token symbol

### LoyaltyTokenReactivated

Emitted when a token is reactivated.

**Parameters:**
- `tokenAddress` (indexed) - Address of the reactivated token
- `activatedBy` (indexed) - Address of the activator
- `message` - Reactivation message

---

## Frontend Integration

### Connecting to the Contract

```javascript
import { CONTRACTS } from '@/config/contracts';
import { useWriteContract, useReadContract } from 'wagmi';

// Creating a program
const { writeContract } = useWriteContract();

await writeContract({
  address: CONTRACTS.LOYALTY_TOKEN_FACTORY.address,
  abi: CONTRACTS.LOYALTY_TOKEN_FACTORY.abi,
  functionName: 'createLoyaltyToken',
  args: [name, symbol, merchantAddress],
});
```

### Getting Creation Events

```javascript
// Fetching token creation history
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

## Security

### Access Control

- Only the factory administrator can update the implementation contract
- Each merchant receives full control over their loyalty token
- The factory uses the proxy pattern for secure upgrades

### Proxy Pattern

The factory creates minimal proxy contracts pointing to a single LoyalSparkERC20 implementation. This allows:
- Saving gas when creating new programs
- Updating token logic without changing addresses
- Isolating the state of each program

---

## Frequently Asked Questions

### How much does it cost to create a program?

The cost depends on the gas price on the Base network. Approximately 0.0001-0.001 ETH per creation transaction.

### Can a merchant create multiple programs?

Yes, a merchant can create an unlimited number of loyalty programs.

### Can the implementation be changed after token creation?

Yes, the factory administrator can update the implementation, and all existing proxies will automatically use the new version.

### How to verify that a token was created through the factory?

You can check the `LoyaltyTokenCreated` events or call `tokenImplementation()` on the proxy and compare it with the address from the factory.

---

## Support

For questions and support:
- Official website: [https://loyalspark.online](https://loyalspark.online)
- Email: support@loyalspark.io

## License

MIT License - see LICENSE file for details.
