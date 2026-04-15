# Press Release: Loyal Spark

## FOR IMMEDIATE RELEASE

---

### Loyal Spark Launches AI-Native Loyalty-as-a-Service Protocol on Base

**First Dual-Mode Loyalty Platform for Humans and Autonomous AI Agents**

---

Loyal Spark, the onchain loyalty platform on Base L2, has launched full AI agent support, becoming the first **Loyalty-as-a-Service protocol** designed for both humans and autonomous AI agents.

#### What's New

- **REST API** — Full programmatic access to create loyalty programs, mint ERC-20 tokens, manage rewards, and trade on marketplace
- **MCP Server** — 9 specialized tools for LLM-based agents (compatible with Claude, GPT, and any MCP client)
- **CDP MPC Wallets** — Each AI agent gets a Coinbase-managed server wallet for autonomous onchain operations
- **Atomic P2P Escrow** — Smart contract-protected token swaps via LoyaltyTokenEscrow with 0.5% protocol fee
- **Tiered Pricing** — Free (200 calls/mo, 1.25% mint fee), Pro ($49 USDC/mo, 0.5% fee), Enterprise ($129 USDC/mo, 0.25% fee); merchant SaaS separate — see loyalspark.online docs

#### Why It Matters

As AI agents proliferate, they need financial infrastructure. Deploying a standalone ERC-20 token gives an agent a currency but no ecosystem. Loyal Spark provides the complete stack: rewards, vouchers, tiers, analytics, CRM, marketing automation, and a liquid marketplace — all accessible via a single API call.

Think **"Shopify for loyalty programs"** — but built for AI agents.

#### The Problem with Solo Tokens

❌ No rewards infrastructure  
❌ No marketplace or liquidity  
❌ No trust or audit history  
❌ No existing user base  
❌ No DeFi yield integration  

#### The Loyal Spark Solution

✅ Full-stack loyalty infrastructure via API  
✅ Built-in P2P marketplace with escrow  
✅ Protocol-level trust and verification  
✅ Access to existing merchant customer bases  
✅ DeFi yield through Aave/Compound strategies  
✅ Autonomous server wallets (Coinbase CDP MPC)  

#### Architecture

- **Dual-mode**: Human UI (PWA/SIWE) + AI API (REST/MCP)
- **Proxy pattern** for gas-efficient token deployment via factory
- **Builder Code** integration (bc_wdmnog7m) for Base ecosystem analytics
- All transactions tracked on-chain on Base L2

#### Smart Contracts (Base Mainnet)

| Contract | Address |
|----------|---------|
| LoyaltyTokenFactory | `0x5F3DdBa12580CFdc6016258774cCc19C4250dA80` |
| LoyalSparkERC20 (impl) | `0xe6BA426C9c51281B929a17444De02c65815E27C3` |
| LoyaltyTokenEscrow (P2P) | `0xA569C95AfC1BCF381c48BcF336ED9D2c014bcdDF` |
| RoundUpVault | `0x9102ada6805DB9100CaE03448B23f2b2668EcFe8` |
| AaveConservativeStrategy | `0xe067a4c3b684f68C3Cbcc63d541414f6cC3fA5B3` |
| LendingPlusStrategy | `0x930E6a11d25822115c5Cc76dFb202dE762CdC8Ab` |

#### For Human Users

Loyal Spark continues to serve merchants and customers through its Progressive Web App:

**For Merchants:**
- Deploy custom ERC-20 loyalty tokens with one click
- Manage rewards, vouchers, tiers, and referral programs
- CRM with RFM segmentation and marketing automation
- Real-time analytics dashboard

**For Customers:**
- True ownership of loyalty tokens in personal wallets
- Redeem tokens for vouchers and exclusive rewards
- Trade tokens on P2P marketplace with escrow protection
- Invest via Round-Up with DeFi yield strategies

#### Getting Started for AI Agents

1. Visit https://loyalspark.online/merchant and connect wallet
2. Open "AI Agents" tab → Register an agent → Get API key (lsk_...)
3. Use the API key in `x-api-key` header for REST or MCP calls
4. Create a server wallet for autonomous onchain operations
5. Start minting tokens, creating rewards, and managing programs!

#### Links

- **Website**: https://loyalspark.online
- **API Docs**: https://loyalspark.online/api-docs
- **Agent Card**: https://loyalspark.online/.well-known/agent.json
- **MCP Server**: Available for Claude, GPT, and any MCP client
- **Twitter/X**: https://x.com/Loyal_Spark

#### Contact

**Media Inquiries:** admin@loyalspark.online

---

### Quick Facts

- **Platform:** Base Network (Ethereum Layer 2)
- **Token Standard:** ERC-20 (proxy pattern)
- **AI Integration:** REST API + MCP Server + CDP MPC Wallets
- **P2P Trading:** Atomic swaps via escrow smart contract
- **DeFi Yield:** Aave & Compound strategies via Round-Up
- **Pricing:** Free / Pro ($49/mo) / Enterprise ($129/mo) in USDC; merchant portal plans separate

---

### Boilerplate

**Short (50 words):**
Loyal Spark is a Loyalty-as-a-Service protocol on Base L2 for both humans and AI agents. Merchants create ERC-20 loyalty programs, customers earn and trade tokens with escrow protection, and AI agents operate autonomously via REST API and MCP Server with Coinbase CDP wallets.

**Medium (100 words):**
Loyal Spark is the first dual-mode loyalty protocol on Base, serving both human users through a PWA and AI agents through a REST API and MCP Server. Merchants deploy custom ERC-20 loyalty tokens via a gas-efficient proxy factory, manage rewards and tiers, and leverage CRM with RFM segmentation. Customers own tokens in their wallets, trade on a P2P marketplace protected by an escrow smart contract, and invest via DeFi yield strategies. AI agents get Coinbase CDP MPC wallets for autonomous operations. Pricing is crypto-native: Free, Pro ($49/mo USDC), or Enterprise ($129/mo USDC) with decreasing mint fees; see current pricing on the site.

---

### Hashtags

Primary: #LoyalSpark #Web3Loyalty #AIAgents #Base #MCP
Secondary: #DeFi #A2A #LoyaltyAsAService #CryptoRewards #ERC20

---

*This press release contains forward-looking statements about Loyal Spark's plans and expectations. Actual results may differ from those described.*