# Round-Up Strategies — Deployment Instructions

## Overview

Deploy 3 smart contracts on **Base Mainnet** in order:

1. **AaveConservativeStrategy** (conservative strategy)
2. **LendingPlusStrategy** (medium risk)
3. **RoundUpVault** (main contract)

After deployment, link strategies to the vault via `setVault()`.

---

## Base Mainnet Addresses

### Core Tokens & Protocols

| Protocol/Token | Address |
|----------------|---------|
| **WETH** | `0x4200000000000000000000000000000000000006` |
| **Chainlink ETH/USD Price Feed** | `0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70` |

### Aave V3 (Conservative Strategy)

| Contract | Address |
|----------|---------|
| **Aave Pool** | `0x403E5c3385731b53e83b4b57424682054A6B8B8f` |
| **aWETH Token** | `0x77c2250d4f6C76426C153f317A71887304192F13` |

### Compound V3 (Medium Risk)

| Contract | Address |
|----------|---------|
| **cWETHv3 Comet** | `0x46e6b214b524310239732D51387075E0e70970bf` |

---

## Step 1: Deploy AaveConservativeStrategy

**Constructor parameters:** None

Save the deployed address as `AAVE_STRATEGY_ADDRESS`.

---

## Step 2: Deploy LendingPlusStrategy

**Constructor parameters:** None

Save the deployed address as `LENDING_PLUS_STRATEGY_ADDRESS`.

---

## Step 3: Deploy RoundUpVault

**Constructor parameters:**
```solidity
address _ethPriceFeed = 0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70
address _strategy = AAVE_STRATEGY_ADDRESS // or LENDING_PLUS_STRATEGY_ADDRESS
```

Save the deployed address as `ROUND_UP_VAULT_ADDRESS`.

---

## Step 4: Link Strategies to Vault

Call `setVault(ROUND_UP_VAULT_ADDRESS)` on both strategy contracts. Only the `owner` (deployer) can execute this.

---

## Step 5: Verification

1. **AaveConservativeStrategy**: `vault` = `ROUND_UP_VAULT_ADDRESS`, `owner` = your address
2. **LendingPlusStrategy**: `vault` = `ROUND_UP_VAULT_ADDRESS`, `owner` = your address
3. **RoundUpVault**: `strategy` = chosen strategy address, `owner` = your address

---

## Step 6: Test Transactions

```solidity
// Initialize user settings
RoundUpVault.initializeSettings()

// Test round-up (send 0.01 ETH, primaryTxValueUSD = 340 = $3.40)
RoundUpVault.roundUp(340) payable

// Check balance
RoundUpVault.userBalances(YOUR_ADDRESS)
```

---

## Switching Strategies

```solidity
RoundUpVault.updateStrategy(NEW_STRATEGY_ADDRESS) // owner only
```

---

## Emergency Functions

```solidity
RoundUpVault.emergencyWithdraw()
AaveConservativeStrategy.emergencyWithdraw()
LendingPlusStrategy.emergencyWithdraw()
```

All emergency functions are restricted to `owner` only.

---

## Final Addresses (Fill After Deployment)

```javascript
const CONTRACTS = {
  BASE_MAINNET: {
    AAVE_CONSERVATIVE_STRATEGY: "0x...",
    LENDING_PLUS_STRATEGY: "0x...",
    ROUND_UP_VAULT: "0x...",
    WETH: "0x4200000000000000000000000000000000000006",
    AAVE_POOL: "0x403E5c3385731b53e83b4b57424682054A6B8B8f",
    COMPOUND_CWETH: "0x46e6b214b524310239732D51387075E0e70970bf",
    ETH_USD_PRICE_FEED: "0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70"
  }
};
```

---

## Security

- All contracts use `onlyOwner` / `onlyVault` modifiers
- Token approvals configured correctly
- Emergency withdraw functions protected
- Contracts audited for reentrancy (use `call` with checks)
