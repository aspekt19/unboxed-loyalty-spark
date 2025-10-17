# 🎯 Loyal Spark ERC-20 Token Contract

<div align="center">

![BASE Network](https://img.shields.io/badge/BASE-Mainnet-blue?style=for-the-badge&logo=ethereum)
![Solidity](https://img.shields.io/badge/Solidity-%5E0.8.0-363636?style=for-the-badge&logo=solidity)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)

**Decentralized Loyalty Rewards on Blockchain**

[Documentation](https://docs.loyalspark.app) • [Factory Contract](https://github.com/aspekt19/LoyaltyTokenFactory) • [Web App](https://github.com/aspekt19/loyal-spark)

</div>

---

## 📋 Overview

The **Loyal Spark ERC-20** smart contract is the core token implementation for decentralized loyalty reward programs. Each merchant can deploy their own branded loyalty token with customizable parameters, enabling transparent and transferable reward systems on the BASE blockchain.

### ✨ Key Features

- **🪙 ERC-20 Standard Compliance** - Full compatibility with wallets and DEXs
- **🔥 Built-in Burn Mechanism** - Customers can redeem rewards by burning tokens
- **🎨 Customizable Metadata** - Merchants set token name, symbol, and metadata URI
- **🔒 Merchant-Only Minting** - Only the merchant can mint new reward tokens
- **🌐 Decentralized & Transparent** - All transactions visible on-chain
- **💱 Tradeable** - Tokens can be transferred between users or traded on DEXs

---

## 🏗️ Contract Architecture

```solidity
contract LoyalSparkERC20 is ERC20, Ownable
```

### Core Functions

#### For Merchants (Owner)

```solidity
function mintLoyaltyPoints(address to, uint256 amount) external onlyOwner
```
Mint new loyalty tokens to reward customers.

```solidity
function setTokenURI(string memory newTokenURI) external onlyOwner
```
Update token metadata URI for additional information.

#### For Customers

```solidity
function burnLoyaltyPoints(uint256 amount) external
```
Burn tokens to redeem rewards or benefits from the merchant.

```solidity
function transfer(address to, uint256 amount) external returns (bool)
```
Transfer tokens to other users (standard ERC-20).

---

## 🚀 Deployment

### Prerequisites

- Solidity compiler `^0.8.0`
- BASE Mainnet RPC endpoint
- Deployment wallet with BASE ETH

### Constructor Parameters

```solidity
constructor(
    string memory name,        // Token name (e.g., "Starbucks Rewards")
    string memory symbol,      // Token symbol (e.g., "SBUX")
    string memory tokenURI,    // Metadata URI
    address initialOwner       // Merchant wallet address
)
```

### Example Deployment

```javascript
const tokenName = "Coffee Shop Rewards";
const tokenSymbol = "COFFEE";
const tokenURI = "ipfs://QmExample...";
const merchantAddress = "0x1234...";

const LoyalSparkToken = await ethers.deployContract("LoyalSparkERC20", [
  tokenName,
  tokenSymbol,
  tokenURI,
  merchantAddress
]);
```

---

## 🔗 Network Information

| Parameter | Value |
|-----------|-------|
| **Blockchain** | BASE Mainnet |
| **Chain ID** | 8453 |
| **Token Standard** | ERC-20 |
| **Factory Contract** | `0x61b154cAE13F2312D33397419195753D3849F858` |
| **Default Token** | `0xc46481b25a0E6161d87F84C0dd2B0721B891cB4e` |

---

## 💡 Use Cases

### 🏪 Retail Loyalty Programs
Coffee shops, restaurants, and retail stores can issue tokens for purchases and allow customers to burn them for discounts or free items.

### 🎮 Gaming & Community Rewards
Game developers and community platforms can reward engagement with tradeable tokens.

### 🎓 Membership Programs
Gyms, clubs, and subscription services can use tokens for tier-based benefits.

### 🤝 Multi-Merchant Ecosystems
Multiple merchants can create interoperable loyalty programs where tokens from different programs can be traded or pooled.

---

## 🔒 Security Features

- ✅ **OpenZeppelin Contracts** - Battle-tested, audited base implementations
- ✅ **Owner-Only Minting** - Prevents unauthorized token creation
- ✅ **Burn from Own Balance** - Users can only burn their own tokens
- ✅ **Standard ERC-20** - Compatible with existing security tools and wallets

---

## 📊 Token Economics

| Feature | Details |
|---------|---------|
| **Initial Supply** | 0 (tokens minted on-demand) |
| **Max Supply** | Unlimited (controlled by merchant) |
| **Decimals** | 18 (standard ERC-20) |
| **Burn Mechanism** | Direct burn by token holders |
| **Transfer** | Unrestricted (standard ERC-20) |

---

## 🛠️ Integration Example

### Web3 Integration (ethers.js)

```javascript
import { ethers } from 'ethers';
import LoyalSparkABI from './LoyalSparkERC20.json';

// Connect to contract
const provider = new ethers.providers.Web3Provider(window.ethereum);
const signer = provider.getSigner();
const tokenContract = new ethers.Contract(tokenAddress, LoyalSparkABI, signer);

// Check balance
const balance = await tokenContract.balanceOf(userAddress);

// Burn tokens (redeem rewards)
const tx = await tokenContract.burnLoyaltyPoints(ethers.utils.parseEther("10"));
await tx.wait();

// Transfer tokens
const transfer = await tokenContract.transfer(recipientAddress, amount);
await transfer.wait();
```

---

## 📚 Related Resources

- **🏭 [Loyalty Token Factory](https://github.com/aspekt19/LoyaltyTokenFactory)** - Deploy new loyalty programs
- **💻 [Loyal Spark Web App](https://github.com/aspekt19/loyal-spark)** - Frontend application
- **📖 [BASE Network Docs](https://docs.base.org)** - Blockchain documentation
- **🎨 [Media Kit](https://github.com/aspekt19/loyal-spark/blob/main/public/media-kit/README.md)** - Brand assets

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

## 🌟 Acknowledgments

- Built on [OpenZeppelin](https://openzeppelin.com/) contracts
- Deployed on [BASE Network](https://base.org/)
- Part of the Loyal Spark ecosystem

---

<div align="center">

**Built with ❤️ for the Web3 community**

[Website](https://loyalspark.app) • [Twitter](#) • [Discord](#)

</div>
