# Loyal Spark — Farcaster Mini App

A decentralized loyalty program integrated with Farcaster, built on Base Mainnet blockchain.

## Overview

Loyal Spark Farcaster App enables merchants and customers to participate in a tokenized loyalty ecosystem through the Farcaster social network. The platform supports **flexible sign-in**: email/phone/Google via Privy (embedded wallet created automatically), traditional wallets (MetaMask, WalletConnect), or automatic Farcaster connection inside Warpcast. AI agents integrate via REST API, MCP Server, or pay-per-request gateways (MPP / x402).

## Features

### For Merchants
- **Create Loyalty Programs**: Deploy ERC-20 loyalty tokens on Base
- **Issue Tokens**: Reward customers with loyalty tokens
- **Manage Rewards**: Create and manage reward vouchers
- **CRM & Analytics**: Customer profiles, RFM segmentation, tier management
- **Marketing Automation**: Automated campaigns and personalized offers
- **AI Agent Management**: Register AI agents, manage API keys, monitor activity
- **Set Expiration**: Configure program end dates with automatic handling
- **Reviews**: Collect and respond to customer reviews

### For Customers
- **Collect Tokens**: Receive loyalty tokens from merchants
- **View Portfolio**: Track all loyalty tokens in one dashboard
- **Redeem Rewards**: Exchange tokens for merchant vouchers
- **Trade on DEX**: Swap tokens on decentralized exchanges
- **P2P Marketplace**: Trade loyalty tokens with other users
- **Round-Up Investment**: Grow rewards through DeFi strategies
- **Referral Programs**: Earn bonuses by referring friends

### For AI Agents
- **REST API**: 25 authenticated routes + **GET `/vouchers/status`** (public); see root `README.md` or `public/llms-full.txt`
- **MCP Server**: **36** merchant tools + **18** recipient tools — Streamable HTTP; same surface as REST for LLM clients
- **MPP Gateway**: Pay-per-request with USDC/pathUSD on Tempo chain
- **x402 Gateway**: Pay-per-request with USDC on Base (Coinbase protocol)
- **Server Wallets**: Coinbase CDP MPC wallets for autonomous onchain operations
- **Program Ownership**: Agents can own programs via CDP wallets (`use_agent_wallet: true`)
- **Voucher Lifecycle**: Full redeem → use cycle via API (agents can act as both merchant and customer)
- **Skills**: 12 Markdown guides (`00`–`11`) at `/.well-known/skills/` (source: `public/.well-known/skills/`)
- **Tiered Plans**: Free → Pro ($49/mo) → Enterprise ($129/mo) in USDC (see `docs/business/MONETIZATION_AND_PRICING.md`)

## Technology Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS with custom design system
- **Blockchain**: Wagmi + Viem + Privy
- **Authentication**: Email/Phone/Google (Privy embedded wallets) + SIWE + Farcaster Auth Kit
- **Backend**: Supabase (Postgres + Edge Functions)
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
- Email, phone number, Google account, or Web3 wallet (MetaMask, Coinbase Wallet, etc.)
- Farcaster account (optional, for miniapp features)

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

## AI Agent Integration

### Quick Start

1. At `/merchant`, sign in (email, passkey, or wallet) using the header **Sign In** (**Profile** appears only after a session). Open **AI Agents** → Register agent → copy API key (`lsk_...`). See [PORTALS_AND_TEAM.md](../development/PORTALS_AND_TEAM.md).
2. Use REST API or MCP Server with the key in `x-api-key` header
3. Optionally create a server wallet for autonomous onchain operations

```bash
# Example: List programs
curl -H "x-api-key: lsk_YOUR_KEY" \
  https://api.loyalspark.online/agent-api/programs
```

### REST API Endpoints (25 + 1 public)

| Method | Endpoint | Scope | Description |
|--------|----------|-------|-------------|
| GET | `/programs` | read | List loyalty programs (supports CDP wallet) |
| POST | `/programs` | mint/create_program | Get calldata to deploy a new token |
| POST | `/register-program` | mint/create_program | Register a deployed token |
| POST | `/activate-program` | mint/create_program | Get activation calldata |
| POST | `/program-status` | mint/create_program | Update program status |
| GET | `/rewards` | read | List rewards for a program |
| POST | `/rewards` | manage_rewards | Create a new reward |
| POST | `/mint` | mint | Mint tokens to a customer |
| POST | `/transfer` | mint | Transfer tokens between wallets |
| GET | `/balance` | read | Get customer balance & tier |
| GET | `/customers` | read | List customers |
| GET | `/vouchers` | read | List vouchers |
| POST | `/redeem-reward` | read | Redeem reward: verify tx + create voucher |
| POST | `/vouchers/use` | manage_rewards | Mark voucher as used |
| GET | `/analytics` | read | Get merchant analytics |
| GET | `/offers` | trade/read | List active P2P offers |
| POST | `/offers` | trade | Create a P2P escrow offer |
| POST | `/accept-offer` | trade | Accept a P2P offer |
| POST | `/cancel-offer` | trade | Cancel your P2P offer |
| GET | `/me` | any | Get agent info |
| GET | `/tx-receipt` | any | Extract token_address from deploy tx |
| GET | `/vouchers/status` | public | Check voucher status (no API key) |

### MCP Server Tools (36 merchant + 18 recipient)

| Tool | Scope | Description |
|------|-------|-------------|
| `get_platform_info` | any | Protocol metadata |
| `get_my_profile` | any | Agent identity |
| `list_loyalty_programs` | read | Merchant programs |
| `create_loyalty_program` | mint/create_program | Deploy calldata |
| `register_loyalty_program` | mint/create_program | Register deployed token |
| `activate_loyalty_program` | mint/create_program | Activation calldata |
| `update_program_status` | mint/create_program | Update status |
| `list_rewards` | read | Program rewards |
| `create_reward` | manage_rewards | Create reward |
| `mint_loyalty_tokens` | mint | Mint calldata |
| `transfer_loyalty_tokens` | mint | Transfer calldata |
| `get_token_balance` | read | Balance & tier info |
| `get_program_analytics` | read | Analytics metrics |
| `list_marketplace_offers` | any | P2P offers |
| `redeem_reward` | read | Redeem reward → create voucher |
| `use_voucher` | manage_rewards | Mark voucher as used |
| `check_voucher_status` | public | Check voucher status (no API key) |

### Payment Gateways

| Gateway | Currency | Pricing |
|---------|----------|---------|
| **MPP** (Machine Payments Protocol) | USDC / pathUSD on Tempo | $0.001–$0.05/request |
| **x402** (Coinbase) | USDC on Base | $0.001–$0.05/request |
| **API Key** (subscription) | USDC monthly | Free / $49 / $129 |

### Discovery

- Agent manifest: `https://loyalspark.online/.well-known/agent.json`
- Skills index: `https://loyalspark.online/.well-known/skills/index.md`
- OpenAPI spec: `https://loyalspark.online/openapi.json`
- MPP manifest: `https://loyalspark.online/.well-known/mpp.json`
- llms.txt: `https://loyalspark.online/llms.txt`

See [API Documentation](https://loyalspark.online/api-docs) for full details.

## Edge Functions

| Function | Purpose |
|----------|---------|
| `agent-api` | REST API for AI agents (25 routes + public GET `/vouchers/status`) |
| `agent-api-key` | API key generation |
| `agent-wallet` | CDP MPC wallet management |
| `loyalty-mcp` | MCP Server for LLMs (36 merchant tools; recipient MCP has 18) |
| `mpp-gateway` | MPP pay-per-request gateway |
| `x402-gateway` | x402/Coinbase pay-per-request gateway |
| `siwe-nonce` | SIWE nonce generation |
| `siwe-verify` | Wallet authentication |
| `frame` | Farcaster Frame handler |
| `miniapp-webhook` | Farcaster Mini App webhook |
| `get-token-holders` | Token holder queries |
| `sync-mint-history` | Blockchain mint sync |
| `process-automation` | Marketing automation triggers |
| `check-program-expiration` | Program expiration handling |
| `check-premium-expiration` | Premium subscription expiration |
| `verify-payment` | Payment verification |
| `verify-agent-plan-payment` | Agent plan USDC payment verification |
| `verify-voucher` | Voucher code verification |

## Builder Code

All transactions tagged with Base Builder Code `bc_wdmnog7m` (ERC-8021) for [base.dev](https://base.dev) analytics.

## Links

- **Website**: [loyalspark.online](https://loyalspark.online)
- **API Docs**: [loyalspark.online/api-docs](https://loyalspark.online/api-docs)
- **Twitter/X**: [x.com/Loyal_Spark](https://x.com/Loyal_Spark)
- **Email**: admin@loyalspark.online

## License

MIT License — see LICENSE file for details.
