# LoyalSparkERC20 - Smart Contract Documentation

## Overview

LoyalSparkERC20 is an extended ERC20 token implementation with loyalty program management functions, including mint, burn, pause, and activity status.

**Official project website:** [https://loyalspark.online](https://loyalspark.online)

## Contract Addresses (Base Mainnet)

- **LoyaltyTokenFactory**: `0x5F3DdBa12580CFdc6016258774cCc19C4250dA80`
- **LoyalSparkERC20 (Implementation)**: `0xe6BA426C9c51281B929a17444De02c65815E27C3`
- **Chain ID**: `8453` (Base Mainnet)

---

## Standard ERC20 Functions

### `balanceOf(address account) → uint256` (view)

Returns the token balance at the specified address.

**Example:**
```javascript
const balance = await tokenContract.balanceOf(userAddress);
```

### `transfer(address to, uint256 amount) → bool`

Transfers tokens to the specified address.

**Example:**
```javascript
await tokenContract.transfer(recipientAddress, ethers.parseUnits("10", 18));
```

### `approve(address spender, uint256 amount) → bool`

Allows the specified address to spend tokens on behalf of the owner.

**Example:**
```javascript
await tokenContract.approve(spenderAddress, ethers.parseUnits("100", 18));
```

### `allowance(address owner, address spender) → uint256` (view)

Returns the amount of tokens that `spender` can spend on behalf of `owner`.

**Example:**
```javascript
const allowance = await tokenContract.allowance(ownerAddress, spenderAddress);
```

### `transferFrom(address from, address to, uint256 amount) → bool`

Transfers tokens from one address to another (requires prior `approve`).

**Example:**
```javascript
await tokenContract.transferFrom(fromAddress, toAddress, ethers.parseUnits("50", 18));
```

### `name() → string` (view)

Returns the token name.

### `symbol() → string` (view)

Returns the token symbol.

### `decimals() → uint8` (view)

Returns the number of decimal places (typically 18).

### `totalSupply() → uint256` (view)

Returns the total supply of issued tokens.

---

## Extended Management Functions

### `mint(address account, uint256 amount)`

Mints new tokens to the specified address.

**Restrictions:**
- Can only be called by the owner (merchant)
- Requires active minting status (`isMintingActive == true`)

**Parameters:**
- `account` - Token recipient address
- `amount` - Token amount (in wei, i.e., with 18 decimals)

**Example:**
```javascript
// Mint 100 tokens
await tokenContract.mint(customerAddress, ethers.parseUnits("100", 18));
```

### `burn(address account, uint256 amount)`

Burns (destroys) tokens from the specified address.

**Restrictions:**
- Can only be called by the owner (merchant)
- Does not require `approve` from token holder

**Parameters:**
- `account` - Address from which tokens are burned
- `amount` - Amount of tokens to burn

**Usage:**
Used when deleting a loyalty program to burn all existing tokens.

**Example:**
```javascript
// Burn all user tokens
await tokenContract.burn(customerAddress, balance);
```

---

## Status Management Functions

### `enableMinting()`

Enables the ability to mint new tokens.

**Restrictions:**
- Owner only

**Example:**
```javascript
await tokenContract.enableMinting();
```

### `disableMinting()`

Disables the ability to mint new tokens.

**Restrictions:**
- Owner only

**Example:**
```javascript
await tokenContract.disableMinting();
```

### `pauseUtility()`

Pauses token usage (transfers, reward activation).

**Restrictions:**
- Owner only

**Effects:**
- All `transfer` and `transferFrom` calls will be rejected
- Tokens remain in balance but cannot be used

**Example:**
```javascript
await tokenContract.pauseUtility();
```

### `unpauseUtility()`

Resumes token usage.

**Restrictions:**
- Owner only

**Example:**
```javascript
await tokenContract.unpauseUtility();
```

---

## Status View Functions

### `isMintingActive() → bool` (view)

Checks if token minting is active.

**Returns:**
- `true` - minting is allowed
- `false` - minting is blocked

**Example:**
```javascript
const isActive = await tokenContract.isMintingActive();
```

### `isUtilityActive() → bool` (view)

Checks if token usage is active (not paused).

**Returns:**
- `true` - tokens can be transferred and used
- `false` - tokens are paused

**Example:**
```javascript
const isActive = await tokenContract.isUtilityActive();
```

### `getMerchantAddress() → address` (view)

Returns the merchant owner address of the program.

**Example:**
```javascript
const merchantAddress = await tokenContract.getMerchantAddress();
```

### `owner() → address` (view)

Returns the contract owner address (typically matches the merchant).

**Example:**
```javascript
const owner = await tokenContract.owner();
```

---

## Program Lifecycle

### 1. Issuing Tokens to Customers

```javascript
// Merchant mints tokens to customer
await loyaltyToken.mint(
  customerAddress,
  ethers.parseUnits("50", 18) // 50 токенов
);
```

### 2. Using Tokens

```javascript
// Customer transfers tokens to merchant to activate reward
await loyaltyToken.transfer(
  merchantAddress,
  ethers.parseUnits("10", 18) // 10 токенов за вознаграждение
);
```

### 3. Pausing the Program

```javascript
// Merchant temporarily pauses the program
await loyaltyToken.pauseUtility();

// Check status
const isActive = await loyaltyToken.isUtilityActive(); // false
```

### 4. Resuming the Program

```javascript
// Merchant resumes the program
await loyaltyToken.unpauseUtility();
```

### 5. Deleting the Program

```javascript
// Get all token holders
const holders = await getTokenHolders(tokenAddress);

// Burn tokens from all holders in batches of 5
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

## Security and Restrictions

### Access Control

- **Owner only** can:
  - Mint tokens (`mint`)
  - Burn tokens (`burn`)
  - Enable/disable minting
  - Pause/unpause usage

### Protection Against Abuse

1. **Pause mechanism**: Allows merchant to instantly stop all token operations
2. **Burn without approve**: Merchant can burn tokens from any holder without prior approval (for program closure)
3. **Disable minting**: Prevents minting of new tokens after program completion

### Program Status States

The program can be in one of the following states:

| Status | isMintingActive | isUtilityActive | Description |
|--------|----------------|-----------------|----------|
| **Active** | ✅ true | ✅ true | Fully operational program |
| **Paused** | ✅ true | ❌ false | Tokens frozen, minting possible |
| **Closed** | ❌ false | ❌ false | Program completed |

---

## Frontend Integration

### Connecting to the Contract

```javascript
import { CONTRACTS } from '@/config/contracts';
import { useWriteContract, useReadContract } from 'wagmi';

// Minting tokens
const { writeContract } = useWriteContract();

await writeContract({
  address: tokenAddress,
  abi: CONTRACTS.LOYAL_SPARK_ERC20.abi,
  functionName: 'mint',
  args: [recipientAddress, amount],
});
```

### Reading Status

```javascript
// Checking program status
const { data: isActive } = useReadContract({
  address: tokenAddress,
  abi: CONTRACTS.LOYAL_SPARK_ERC20.abi,
  functionName: 'isUtilityActive',
});
```

### Managing Status

```javascript
// Pause program
await writeContract({
  address: tokenAddress,
  abi: CONTRACTS.LOYAL_SPARK_ERC20.abi,
  functionName: 'pauseUtility',
});

// Resume program
await writeContract({
  address: tokenAddress,
  abi: CONTRACTS.LOYAL_SPARK_ERC20.abi,
  functionName: 'unpauseUtility',
});
```

---

## Frequently Asked Questions

### Can burned tokens be recovered?

No, burned tokens are permanently deleted and cannot be recovered.

### What happens to tokens when paused?

Tokens remain in holders' balances but cannot be transferred or used until the pause is lifted.

### Can the program owner be changed?

Yes, using the standard `transferOwnership` function (if implemented in the contract).

### Can tokens be used on DEXs?

Yes, tokens are fully ERC20 compliant and can be traded on any DEX (Uniswap, SushiSwap, etc.).

### What happens when trying to transfer while paused?

The transaction will be rejected with an error, and tokens will remain in the sender's balance.

---

## Support

For questions and support:
- Official website: [https://loyalspark.online](https://loyalspark.online)
- Email: support@loyalspark.io

## License

MIT License - see LICENSE file for details.
