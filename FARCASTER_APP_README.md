# Loyal Spark — Farcaster Mini App

A decentralized loyalty program integrated with Farcaster, built on Base Mainnet blockchain.

## Overview

Loyal Spark Farcaster App enables merchants and customers to participate in a tokenized loyalty ecosystem through the Farcaster social network. The platform operates in **dual mode**: humans use the UI with wallet authentication, while AI agents integrate via REST API or MCP Server.

## Features

### For Merchants
- **Create Loyalty Programs**: Deploy ERC-20 loyalty tokens on Base
- **Issue Tokens**: Reward customers with loyalty tokens
- **Manage Rewards**: Create and manage reward vouchers
- **CRM & Analytics**: Customer profiles, RFM segmentation, tier management
- **Marketing Automation**: Automated campaigns and personalized offers
- **AI Agent Management**: Register AI agents, manage API keys, monitor activity
- **Set Expiration**: Configure program end dates with automatic handling

### For Customers
- **Collect Tokens**: Receive loyalty tokens from merchants
- **View Portfolio**: Track all loyalty tokens in one dashboard
- **Redeem Rewards**: Exchange tokens for merchant vouchers
- **Trade on DEX**: Swap tokens on decentralized exchanges
- **Round-Up Investment**: Grow rewards through DeFi strategies

### For AI Agents
- **REST API**: Full CRUD operations with scoped permissions
- **MCP Server**: Direct integration with Claude, GPT, Cursor
- **Server Wallets**: Coinbase CDP MPC wallets for autonomous operations
- **Tiered Plans**: Free → Pro ($29/mo) → Enterprise ($99/mo) in USDC

## Technology Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS with custom design system
- **Blockchain**: Wagmi + Viem + RainbowKit
- **Authentication**: Farcaster Auth Kit + SIWE
- **Backend**: Lovable Cloud
- **Agent Wallets**: Coinbase CDP MPC
- **State**: React Query (TanStack Query)
- **UI Components**: Radix UI + shadcn/ui

## Smart Contracts

| Contract | Address |
|----------|---------|
| **LoyaltyTokenFactory** | `0x5F3DdBa12580CFdc6016258774cCc19C4250dA80` |
| **LoyalSparkERC20** | `0xe6BA426C9c51281B929a17444De02c65815E27C3` |
| **Network** | Base Mainnet (Chain ID: 8453) |

## Setup

### Prerequisites
- Node.js 18+ or Bun
- Web3 wallet (MetaMask, Rainbow, etc.)
- Farcaster account

### Installation

```bash
git clone <repository-url>
cd loyal-spark-farcaster
npm install
npm run dev
```

### Environment

Environment variables are automatically configured via Lovable Cloud:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`

## AI Agent Quick Start

1. Connect wallet → Open **AI Agents** tab → Register agent → Get API key (`lsk_...`)
2. Use REST API or MCP Server with the key in `x-api-key` header
3. Optionally create a server wallet for autonomous onchain operations

```bash
# Example: List programs
curl -H "x-api-key: lsk_YOUR_KEY" \
  https://bzxmejzssxjazswgwqqs.supabase.co/functions/v1/agent-api/programs
```

See [API Documentation](https://loyalspark.online/api-docs) and [Agent Discovery](https://loyalspark.online/.well-known/agent.json) for full details.

## Edge Functions

| Function | Purpose |
|----------|---------|
| `agent-api` | REST API for AI agents |
| `agent-wallet` | CDP MPC wallet management |
| `loyalty-mcp` | MCP Server for LLMs |
| `siwe-verify` | Wallet authentication |
| `check-program-expiration` | Program expiration handling |
| `verify-agent-plan-payment` | USDC payment verification |

## Builder Code

All transactions tagged with Base Builder Code `bc_wdmnog7m` (ERC-8021) for [base.dev](https://base.dev) analytics.

## Links

- **Website**: [loyalspark.online](https://loyalspark.online)
- **API Docs**: [loyalspark.online/api-docs](https://loyalspark.online/api-docs)
- **Twitter/X**: [x.com/Loyal_Spark](https://x.com/Loyal_Spark)
- **Email**: admin@loyalspark.online

## License

MIT License — see LICENSE file for details.
