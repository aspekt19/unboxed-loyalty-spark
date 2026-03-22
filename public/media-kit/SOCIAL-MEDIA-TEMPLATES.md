# Loyal Spark — Social Media Templates

Ready-to-use content templates for social media platforms, updated with AI agent capabilities.

---

## 🐦 Twitter/X Templates

### AI Agent Launch Thread (5 Posts)

**Post 1/5:**
```
🧵 We just made loyalty programs AI-native.

Loyal Spark is now a Loyalty-as-a-Service protocol on @base.

AI agents can autonomously:
• Create ERC-20 loyalty programs
• Mint tokens to customers
• Manage rewards & vouchers
• Trade on P2P marketplace

All via REST API or MCP Server 🔗
```

**Post 2/5:**
```
🤖 How it works for AI agents:

1️⃣ Connect wallet → Register agent → Get API key (lsk_...)
2️⃣ Each agent gets a Coinbase CDP MPC wallet — no private keys needed
3️⃣ Call our API to mint tokens, create rewards, manage programs
4️⃣ Atomic P2P swaps via escrow smart contract

Full docs: https://loyalspark.online/api-docs
```

**Post 3/5:**
```
💰 Why build on Loyal Spark instead of deploying your own token?

❌ Solo token = no rewards infra, no marketplace, no trust, no audience

✅ Loyal Spark = full stack:
→ Rewards & vouchers
→ Tier system (Bronze→Platinum)
→ P2P marketplace with escrow
→ DeFi yield (Aave/Compound)
→ CRM & analytics
→ All via single API
```

**Post 4/5:**
```
📊 Pricing for AI agents:

🆓 Free — 100 API calls/mo, 1% tx fee
💎 Pro ($29/mo USDC) — 10K calls, 0.5% fee
🏢 Enterprise ($99/mo USDC) — Unlimited, 0.25% fee

All payments on-chain in USDC on @base
No credit cards. No KYC. Pure crypto-native.
```

**Post 5/5:**
```
🔗 Get started:

📖 API Docs: https://loyalspark.online/api-docs
🤖 Agent Card: https://loyalspark.online/.well-known/agent.json
🔧 MCP Server: Ready for Claude, GPT & other LLMs
🌐 App: https://loyalspark.online

Built on @base | Powered by Coinbase CDP

#AI #Web3 #Base #Loyalty #MCP #A2A
```

### Feature Highlights

**Escrow P2P:**
```
🔐 P2P token trading just got trustless.

Our new LoyaltyTokenEscrow contract on @base enables atomic swaps:
→ Creator locks tokens in escrow
→ Accepter fills → both sides swap in ONE transaction
→ Or creator cancels → tokens returned

0.5% protocol fee. Zero trust required.

Verified on BaseScan ✅
```

**MCP Server:**
```
🔧 Loyal Spark now has an MCP Server!

9 tools for AI agents:
• get_platform_info
• mint_loyalty_tokens
• create_reward
• list_marketplace_offers
• ...and 5 more

Compatible with Claude, GPT, and any MCP client.

Add to your config:
loyalspark.online/.well-known/agent.json
```

**CDP Wallets:**
```
🏦 AI agents on Loyal Spark get their own wallets.

Coinbase CDP MPC wallets on @base:
→ No private keys to manage
→ Server-side transaction signing
→ Enterprise-grade MPC security
→ Automatic creation via API

Your agent. Its wallet. Full autonomy.
```

### Merchant-Focused
```
Merchants: Your loyalty program just got an AI upgrade 🛍️

With Loyal Spark you can:
• Deploy custom loyalty tokens on @base
• Let AI agents manage your program 24/7
• Escrow-protected P2P marketplace
• DeFi yield on customer tokens

Plus full CRM, tiers, referrals, and analytics.

Launch your program → loyalspark.online
```

### Customer-Focused
```
Your loyalty points, your rules 💎

With Loyal Spark:
✅ Own your rewards as ERC-20 tokens
✅ Trade on P2P marketplace (escrow protected!)
✅ Invest via Round-Up (Aave/Compound yields)
✅ Redeem for exclusive vouchers
✅ Never expires

Take control → loyalspark.online

#CryptoRewards #Web3 #Base
```

---

## 🟣 Farcaster Cast Templates

### For /base and /ai channels
```
🧵 Loyal Spark just went AI-native 🤖

AI agents can now autonomously run loyalty programs on Base:
→ REST API with full CRUD
→ MCP Server (9 tools for LLMs)
→ CDP MPC wallets for autonomous signing
→ P2P escrow marketplace

Think "Shopify for loyalty" — but for AI agents.

Try it: loyalspark.online/api-docs
```

### For /dev channel
```
⚙️ Technical breakdown of Loyal Spark's A2A protocol:

• ERC-20 proxy pattern (minimal gas via factory)
• Atomic P2P swaps through LoyaltyTokenEscrow contract
• Agent auth: lsk_ API keys (SHA-256 hashed)
• CDP MPC wallets via Coinbase REST API
• Builder Code bc_wdmnog7m on all txs

Open protocol. Agent Card at /.well-known/agent.json
```

### For /loyalty or /commerce channels
```
🏪 Merchants + AI = next-gen loyalty

Register an AI agent to manage your loyalty program:
→ Auto-mint tokens to customers
→ Create/update rewards
→ Monitor analytics
→ Trade on marketplace

All through Loyal Spark on Base.

Setup takes 2 minutes: loyalspark.online/merchant
```

---

## 📋 MCP Directory Submission Template

Use this for glama.ai, smithery.ai, mcp.so, and similar directories:

**Server Name:** Loyal Spark Loyalty Protocol

**Short Description:**
Onchain loyalty-as-a-service on Base L2. Create loyalty programs, mint ERC-20 tokens, manage rewards, and trade on marketplace — all autonomously.

**Category:** Web3 / DeFi / Commerce

**Transport:** Streamable HTTP

**URL:** See agent.json for current endpoint

**Authentication:** API Key (x-api-key header, lsk_ prefix)

**Tools (9):**
| Tool | Description |
|------|-------------|
| get_platform_info | Get protocol info, contracts, and capabilities |
| get_my_profile | Get authenticated agent profile and permissions |
| list_loyalty_programs | List active loyalty programs |
| list_rewards | List rewards for a specific program |
| create_reward | Create a new redeemable reward |
| mint_loyalty_tokens | Mint ERC-20 loyalty tokens |
| get_token_balance | Check balance and tier info |
| get_program_analytics | Get performance metrics |
| list_marketplace_offers | Browse P2P trading offers |

**MCP Client Config:**
```json
{
  "mcpServers": {
    "loyal-spark": {
      "url": "https://bzxmejzssxjazswgwqqs.supabase.co/functions/v1/loyalty-mcp",
      "transport": "streamable-http",
      "headers": {
        "x-api-key": "lsk_your_api_key_here"
      }
    }
  }
}
```

**Tags:** loyalty, rewards, base, erc20, web3, defi, marketplace, onchain, mpc-wallet

**Website:** https://loyalspark.online
**Docs:** https://loyalspark.online/api-docs

---

## 🎯 Distribution Checklist

### Immediate (Today)
- [ ] Post X thread (5 posts)
- [ ] Cast on Farcaster: /base, /ai, /dev
- [ ] Submit to glama.ai MCP directory
- [ ] Submit to smithery.ai
- [ ] Submit to mcp.so

### This Week
- [ ] Submit to Base App Directory (base.dev)
- [ ] Post on Base Discord #showcase
- [ ] Share in AI agent builder communities
- [ ] Cross-post press release on Mirror.xyz

### Ongoing
- [ ] Engage with AI agent projects on Base
- [ ] Track agent registrations and usage
- [ ] Create tutorial video of agent setup
- [ ] Write technical blog post about A2A architecture

---

## 🎨 Hashtag Strategy

**Primary:** #LoyalSpark #Web3Loyalty #AIAgents #Base #MCP
**Secondary:** #A2A #LoyaltyAsAService #DeFi #CryptoRewards #ERC20 #CDP

---

© 2025-2026 Loyal Spark. Built on Base Network.