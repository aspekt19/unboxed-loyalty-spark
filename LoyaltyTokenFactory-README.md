# 🏭 Loyal Spark Token Factory

<div align="center">

![BASE Network](https://img.shields.io/badge/BASE-Mainnet-blue?style=for-the-badge&logo=ethereum)
![Solidity](https://img.shields.io/badge/Solidity-%5E0.8.0-363636?style=for-the-badge&logo=solidity)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)

**One-Click Loyalty Program Deployment**

[Documentation](https://docs.loyalspark.app) • [ERC-20 Contract](https://github.com/aspekt19/LoyalSparkERC20) • [Web App](https://github.com/aspekt19/loyal-spark)

</div>

---

## 📋 Overview

The **Loyalty Token Factory** is a smart contract that enables merchants to deploy their own branded ERC-20 loyalty tokens with a single transaction. No coding required - just provide your token details and start rewarding customers instantly on the BASE blockchain.

### ✨ Key Features

- **⚡ One-Transaction Deployment** - Deploy complete loyalty programs instantly
- **🎨 Full Customization** - Set token name, symbol, and metadata
- **📊 Program Tracking** - Keep track of all deployed loyalty programs
- **🔍 Transparent Registry** - All deployments recorded on-chain
- **💰 Low Gas Costs** - Optimized for BASE Network efficiency
- **🔒 Secure Ownership** - Deployer automatically becomes token owner

---

## 🏗️ Architecture

```solidity
contract LoyaltyTokenFactory
```

### Core Functionality

The factory contract stores the creation code for the LoyalSparkERC20 token and uses the `CREATE` opcode to deploy new instances with custom parameters.

```solidity
function createLoyaltyToken(
    string memory name,
    string memory symbol,
    string memory tokenURI
) external returns (address)
```

---

## 🚀 Deployment Process

### Step 1: Deploy Factory Contract

```javascript
const LoyaltyTokenFactory = await ethers.deployContract("LoyaltyTokenFactory");
await LoyaltyTokenFactory.waitForDeployment();

console.log(`Factory deployed at: ${LoyaltyTokenFactory.target}`);
```

### Step 2: Create Loyalty Programs

Merchants can create their loyalty tokens through the factory:

```javascript
const tx = await factoryContract.createLoyaltyToken(
  "Coffee Shop Rewards",    // Token name
  "COFFEE",                 // Token symbol
  "ipfs://QmExample..."     // Metadata URI
);

const receipt = await tx.wait();
const tokenAddress = receipt.logs[0].address;
```

---

## 📡 Events

### TokenCreated

Emitted when a new loyalty token is deployed:

```solidity
event TokenCreated(
    address indexed tokenAddress,
    address indexed owner,
    string name,
    string symbol,
    string tokenURI
);
```

**Indexing**: Use this event to track all loyalty programs deployed through the factory.

---

## 🔗 Network Information

| Parameter | Value |
|-----------|-------|
| **Blockchain** | BASE Mainnet |
| **Chain ID** | 8453 |
| **Factory Contract** | `0x61b154cAE13F2312D33397419195753D3849F858` |
| **Gas Cost (avg)** | ~2-3M gas per deployment |

---

## 💡 Use Cases

### 🏢 Multi-Store Franchises
Deploy separate loyalty tokens for each franchise location while maintaining brand consistency.

### 🛍️ Marketplace Platforms
E-commerce platforms can offer loyalty program creation as a service to merchants.

### 🎯 Brand Partnerships
Multiple brands can create their own tokens while participating in a larger loyalty ecosystem.

### 🏪 Small Business Onboarding
Simplify Web3 adoption for small businesses with one-click loyalty program creation.

---

## 🛠️ Integration Example

### Complete Merchant Onboarding Flow

```javascript
import { ethers } from 'ethers';
import FactoryABI from './LoyaltyTokenFactory.json';
import TokenABI from './LoyalSparkERC20.json';

// Step 1: Connect to factory
const provider = new ethers.providers.Web3Provider(window.ethereum);
const signer = provider.getSigner();
const factory = new ethers.Contract(factoryAddress, FactoryABI, signer);

// Step 2: Create loyalty token
const createTx = await factory.createLoyaltyToken(
  "My Business Rewards",
  "MYBIZ",
  "ipfs://QmMetadata..."
);

// Step 3: Get deployed token address
const receipt = await createTx.wait();
const tokenCreatedEvent = receipt.logs.find(
  log => log.topics[0] === ethers.utils.id("TokenCreated(address,address,string,string,string)")
);
const tokenAddress = ethers.utils.getAddress("0x" + tokenCreatedEvent.topics[1].slice(26));

// Step 4: Interact with new token
const token = new ethers.Contract(tokenAddress, TokenABI, signer);

// Mint initial rewards
await token.mintLoyaltyPoints(customerAddress, ethers.utils.parseEther("100"));
```

---

## 📊 Factory Statistics

Track factory usage with these queries:

```javascript
// Get total deployments
const filter = factory.filters.TokenCreated();
const events = await factory.queryFilter(filter);
console.log(`Total loyalty programs created: ${events.length}`);

// Get programs by merchant
const merchantPrograms = events.filter(
  event => event.args.owner.toLowerCase() === merchantAddress.toLowerCase()
);

// Get recent deployments
const recentPrograms = events.slice(-10);
```

---

## 🔒 Security Considerations

### ✅ Factory Security
- **Deterministic Deployments** - Each token gets a unique address
- **No Admin Functions** - Factory is permissionless and immutable
- **Event Logging** - All deployments are traceable on-chain

### ✅ Token Security
- **OpenZeppelin Base** - Uses audited ERC-20 implementation
- **Ownership Transfer** - Deployer receives ownership automatically
- **No Proxy Risk** - Direct deployment, no upgradeable contracts

---

## 📈 Gas Optimization

The factory uses optimized bytecode deployment:

| Operation | Gas Cost |
|-----------|----------|
| Factory Deployment | ~1.5M gas |
| Token Creation | ~2.5M gas |
| Total Per Program | ~2.5M gas |

**Tips for merchants:**
- Deploy during low network activity
- Batch multiple deployments if possible
- Use BASE Network for lower fees compared to Ethereum mainnet

---

## 🧪 Testing

### Hardhat Test Example

```javascript
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("LoyaltyTokenFactory", function () {
  it("Should deploy a new loyalty token", async function () {
    const [owner] = await ethers.getSigners();
    
    const Factory = await ethers.getContractFactory("LoyaltyTokenFactory");
    const factory = await Factory.deploy();
    
    const tx = await factory.createLoyaltyToken(
      "Test Rewards",
      "TEST",
      "ipfs://test"
    );
    
    const receipt = await tx.wait();
    expect(receipt.status).to.equal(1);
  });
});
```

---

## 📚 Related Resources

- **🪙 [Loyal Spark ERC-20 Contract](https://github.com/aspekt19/LoyalSparkERC20)** - Token implementation
- **💻 [Loyal Spark Web App](https://github.com/aspekt19/loyal-spark)** - User interface
- **🎨 [Media Kit](https://github.com/aspekt19/loyal-spark/blob/main/public/media-kit/README.md)** - Brand guidelines
- **📖 [BASE Network Docs](https://docs.base.org)** - Blockchain documentation
- **🔧 [OpenZeppelin](https://docs.openzeppelin.com/)** - Smart contract library

---

## 🛣️ Roadmap

- [ ] Multi-signature deployment support
- [ ] Template presets for common use cases
- [ ] Enhanced metadata standards
- [ ] Cross-chain deployment support
- [ ] Deployment fee mechanism for sustainability

---

## 🤝 Contributing

We welcome contributions! Here's how you can help:

1. **Report Bugs** - Open an issue with details
2. **Suggest Features** - Share your ideas for improvements
3. **Submit PRs** - Fork, create a branch, and submit a pull request
4. **Improve Docs** - Help make documentation clearer

### Development Setup

```bash
git clone https://github.com/aspekt19/LoyaltyTokenFactory.git
cd LoyaltyTokenFactory
npm install
npx hardhat compile
npx hardhat test
```

---

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

## 🌟 Acknowledgments

- Built with [Hardhat](https://hardhat.org/)
- Uses [OpenZeppelin](https://openzeppelin.com/) contracts
- Deployed on [BASE Network](https://base.org/)
- Part of the Loyal Spark ecosystem

---

<div align="center">

**Empowering Merchants with Blockchain Technology**

[Website](https://loyalspark.app) • [Twitter](#) • [Discord](#)

</div>
