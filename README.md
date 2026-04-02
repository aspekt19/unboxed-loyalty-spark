# Loyal Spark — Onchain Loyalty Protocol

A Web3-powered loyalty platform built on **Base Mainnet**, enabling merchants and AI agents to create custom loyalty token programs while customers earn rewards that automatically invest and grow through DeFi.

## Overview

Loyal Spark revolutionizes traditional loyalty programs by bringing them onchain. It operates as a **dual-mode platform**: humans interact via the web UI with wallet-based authentication (SIWE), while AI agents interact via REST API or MCP Server — sharing the same database, smart contracts, and tokens.

```
┌─────────────────────────────────────────────────┐
│              Loyal Spark Platform                │
│                                                  │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐   │
│  │  Web UI   │    │ REST API │    │MCP Server│   │
│  │ (humans)  │    │ (agents) │    │ (agents) │   │
│  └─────┬─────┘    └─────┬────┘    └─────┬────┘   │
│        │                │               │        │
│        ▼                ▼               ▼        │
│  ┌──────────────────────────────────────────┐    │
│  │        Backend (Edge Functions)           │    │
│  │    Auth · RLS · DB · Realtime             │    │
│  └─────────────────┬────────────────────────┘    │
│                    │                             │
│        ┌───────────┴───────────┐                 │
│        ▼                       ▼                 │
│  ┌──────────┐          ┌──────────────┐          │
│  │ Base L2  │          │ CDP Server   │          │
│  │ Contracts│          │ Wallet (MPC) │          │
│  └──────────┘          └──────────────┘          │
└─────────────────────────────────────────────────┘
```

## Features

### For Merchants (Web UI)
- **Deploy Loyalty Tokens**: Create custom ERC-20 loyalty tokens on Base
- **Mint Tokens**: Issue loyalty points to customers via wallet addresses or QR scan
- **Create Rewards**: Design voucher rewards with token costs
- **CRM & Analytics**: Customer profiles, RFM segmentation, tier management
- **Marketing Automation**: Automated campaigns, personalized offers
- **Referral Programs**: Generate referral codes with bonuses
- **Voucher Management**: Track redemptions with QR code verification
- **AI Agent Management**: Register agents, manage API keys, monitor activity

### For Customers (Web UI)
- **Multi-Token Dashboard**: View all loyalty tokens from different merchants
- **Browse Rewards**: Explore available vouchers across all programs
- **Redeem Vouchers**: Burn tokens to claim exclusive rewards with QR codes
- **DEX Trading**: Trade loyalty tokens on decentralized exchanges
- **Round-Up Investment**: Automatically invest spare change into DeFi (Aave/Compound)
- **Tier System**: Bronze → Silver → Gold → Platinum with increasing perks

### For AI Agents (REST API + MCP)
- **Full CRUD via API**: Create programs, mint tokens, manage rewards, view analytics
- **MCP Server**: Connect Claude, GPT, Cursor, or any MCP-compatible LLM directly
- **Server Wallets**: Coinbase CDP MPC wallets for autonomous onchain operations
- **Scoped Permissions**: Granular access control (read, mint, manage_rewards, trade)
- **Activity Logging**: Full audit trail of all agent operations
- **Tiered Pricing**: Free (100 calls/mo, 1% fee) → Pro ($29/mo, 0.5%) → Enterprise ($99/mo, 0.25%)
- **Skills Documentation**: 11 structured step-by-step guides for agent onboarding and operations

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui |
| Animations | Framer Motion |
| Blockchain | Wagmi v2, Viem, RainbowKit |
| Network | Base Mainnet (Chain ID: 8453) |
| Smart Contracts | ERC-20 Token Standard (Factory pattern) |
| Backend | Lovable Cloud (Supabase Edge Functions) |
| Agent Wallets | Coinbase CDP MPC (Server Wallets) |
| State | React Hooks, TanStack Query v5 |
| Routing | React Router v6 |
| Forms | React Hook Form + Zod validation |
| Builder Attribution | Base Builder Code (ERC-8021) |

## Smart Contract Architecture

| Contract | Address |
|----------|---------|
| **LoyaltyTokenFactory** | `0x5F3DdBa12580CFdc6016258774cCc19C4250dA80` |
| **LoyalSparkERC20 (Implementation)** | `0xe6BA426C9c51281B929a17444De02c65815E27C3` |

**Network**: Base Mainnet (Chain ID: 8453)

### Core Functions
- `deployLoyaltyToken(name, symbol)` — Deploy new ERC-20 token
- `mint(address to, uint256 amount)` — Issue new tokens (owner only)
- `burn(uint256 amount)` — Burn tokens for voucher redemption
- `transfer(address to, uint256 amount)` — Transfer tokens between wallets
- `balanceOf(address account)` — Query token balance

## AI Agent Integration

### Quick Start

1. Go to [loyalspark.online/merchant](https://loyalspark.online/merchant) and connect wallet
2. Open **AI Agents** tab → Register an agent → Copy your API key (`lsk_...`)
3. Use the key in `x-api-key` header for REST or MCP calls

### REST API

```bash
# List loyalty programs
curl -H "x-api-key: lsk_YOUR_KEY" \
  https://bzxmejzssxjazswgwqqs.supabase.co/functions/v1/agent-api/programs

# Mint tokens (1% fee on Free plan)
curl -X POST \
  -H "x-api-key: lsk_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"token_address":"0x...","recipient":"0x...","amount":100}' \
  https://bzxmejzssxjazswgwqqs.supabase.co/functions/v1/agent-api/mint
```

### API Endpoints (22 total)

| Method | Path | Scope | Description |
|--------|------|-------|-------------|
| GET | `/me` | any | Agent profile & permissions |
| GET | `/programs` | read | List loyalty programs |
| POST | `/programs` | create_program | Deploy new ERC-20 token |
| POST | `/register-program` | create_program | Register deployed token |
| POST | `/activate-program` | create_program | Get activation calldata |
| POST | `/program-status` | create_program | Update program status |
| GET | `/rewards` | read | List rewards |
| POST | `/rewards` | manage_rewards | Create reward |
| POST | `/mint` | mint | Mint tokens |
| POST | `/transfer` | mint | Transfer tokens |
| GET | `/balance` | read | Token balance & tier |
| GET | `/customers` | read | Customer list |
| GET | `/vouchers` | read | List vouchers |
| GET | `/vouchers/status` | public | Check voucher status (no API key) |
| POST | `/redeem-reward` | read | Redeem reward → create voucher |
| POST | `/vouchers/use` | manage_rewards | Mark voucher as used |
| GET | `/analytics` | read | Program analytics |
| GET | `/offers` | read | Marketplace offers |
| POST | `/offers` | trade | Create P2P offer |
| POST | `/accept-offer` | trade | Accept P2P offer |
| POST | `/cancel-offer` | trade | Cancel P2P offer |
| GET | `/tx-receipt` | any | Extract token_address from tx |

### MCP Server (for LLMs)

Connect Claude, GPT, or any MCP-compatible agent:

```json
{
  "mcpServers": {
    "loyal-spark": {
      "url": "https://bzxmejzssxjazswgwqqs.supabase.co/functions/v1/loyalty-mcp",
      "headers": {
        "x-api-key": "lsk_YOUR_KEY"
      }
    }
  }
}
```

**Available MCP Tools (17)**: `get_platform_info`, `get_my_profile`, `list_loyalty_programs`, `create_loyalty_program`, `register_loyalty_program`, `activate_loyalty_program`, `update_program_status`, `list_rewards`, `create_reward`, `mint_loyalty_tokens`, `transfer_loyalty_tokens`, `get_token_balance`, `get_program_analytics`, `list_marketplace_offers`, `redeem_reward`, `use_voucher`, `check_voucher_status`

### Agent Discovery

AI agents can discover the protocol automatically via:
- `/.well-known/agent.json` — Full protocol specification, capabilities, pricing
- `/.well-known/skills/` — 11 structured Skills (step-by-step guides for each operation)
- `/api-docs` — Interactive API documentation

### Skills for AI Agents

Structured Markdown guides that teach agents how to use the protocol:

| # | Skill | Description |
|---|-------|-------------|
| 00 | Getting Started | Register agent, get API key, first request |
| 01 | Create Loyalty Program | Deploy ERC-20 loyalty token on Base |
| 02 | Mint Tokens | Mint tokens to customer wallets |
| 03 | Transfer Tokens | Transfer tokens between wallets |
| 04 | Manage Rewards | Create redeemable rewards catalog |
| 05 | Balance & Tiers | Check balances and tier status |
| 06 | Marketplace Trading | P2P token trading with atomic escrow |
| 07 | Analytics & CRM | Program analytics and CRM data |
| 08 | Referrals | Referral programs for organic growth |
| 09 | Vouchers | Voucher lifecycle management |
| 10 | Server Wallets | CDP MPC wallets for autonomous transactions |

Skills index: `https://loyalspark.online/.well-known/skills/index.md`

### Server Wallets (CDP MPC)

Agents can create their own Coinbase MPC wallets on Base for autonomous transactions:

```bash
curl -X POST \
  -H "x-api-key: lsk_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"action":"create_server_wallet"}' \
  https://bzxmejzssxjazswgwqqs.supabase.co/functions/v1/agent-wallet
```

Benefits:
- No private key management — keys are in Coinbase's secure enclave
- Server-side transaction signing
- Automatic Builder Code attribution (ERC-8021)

### Pricing

| Plan | Monthly | API Calls | Agents | Tx Fee |
|------|---------|-----------|--------|--------|
| Free | $0 | 100 | 1 | 1% |
| Pro | $29 USDC | 10,000 | 5 | 0.5% |
| Enterprise | $99 USDC | Unlimited | Unlimited | 0.25% |

Payments accepted on-chain in USDC on Base ($1 = 1 USDC).

## Getting Started

### Prerequisites
- Node.js 18+ or Bun
- MetaMask, Coinbase Wallet, or any WalletConnect-compatible wallet
- Base Mainnet configured in your wallet
- Some ETH on Base for gas fees

### Installation

```bash
git clone https://github.com/aspekt19/unboxed-loyalty-spark.git
cd unboxed-loyalty-spark
npm install
npm run dev
```

### Wallet Setup

1. **Network**: Base Mainnet
2. **Chain ID**: 8453
3. **RPC URL**: https://mainnet.base.org
4. **Currency**: ETH
5. **Explorer**: https://basescan.org

## Project Structure

```
unboxed-loyalty-spark/
├── src/
│   ├── components/
│   │   ├── ui/                    # shadcn/ui library
│   │   ├── agents/                # AI agent management
│   │   ├── rewards/               # Rewards & vouchers
│   │   ├── crm/                   # CRM & analytics
│   │   ├── marketing/             # Campaigns
│   │   ├── automation/            # Marketing automation
│   │   ├── tiers/                 # Customer tiers
│   │   ├── referral/              # Referral programs
│   │   ├── roundup/               # DeFi investment
│   │   ├── marketplace/           # Token trading
│   │   ├── reviews/               # Customer reviews
│   │   ├── onboarding/            # Welcome flows & tours
│   │   └── admin/                 # Platform administration
│   ├── hooks/                     # Custom React hooks
│   ├── config/                    # Contract addresses & ABIs
│   ├── contexts/                  # Auth context
│   ├── integrations/supabase/     # Database client & types
│   ├── pages/                     # Route pages
│   └── lib/                       # Utilities
├── public/
│   ├── .well-known/
│   │   ├── agent.json             # AI agent discovery
│   │   └── farcaster.json         # Farcaster manifest
│   └── media-kit/                 # Brand assets
├── contracts/                     # Solidity contracts
├── supabase/
│   ├── functions/
│   │   ├── agent-api/             # REST API for agents
│   │   ├── agent-wallet/          # CDP wallet management
│   │   ├── agent-api-key/         # API key generation
│   │   ├── loyalty-mcp/           # MCP Server
│   │   ├── siwe-verify/           # Wallet authentication
│   │   ├── verify-payment/        # Payment verification
│   │   └── ...                    # Other edge functions
│   └── migrations/                # Database migrations
└── README.md
```

## Edge Functions

| Function | Purpose |
|----------|---------|
| `agent-api` | REST API for AI agents (CRUD operations) |
| `agent-wallet` | CDP MPC wallet creation & transaction signing |
| `agent-api-key` | API key generation for agents |
| `loyalty-mcp` | MCP Server for LLM integration |
| `siwe-verify` | Sign-In With Ethereum authentication |
| `verify-payment` | Premium subscription payment verification |
| `verify-agent-plan-payment` | Agent plan USDC payment verification |
| `check-premium-expiration` | Subscription expiration checks |
| `check-program-expiration` | Program expiration handling |
| `get-token-holders` | Token holder analytics |
| `process-automation` | Marketing automation triggers |
| `sync-mint-history` | Blockchain mint history sync |
| `verify-voucher` | Voucher verification |

## Security

- **SIWE Authentication**: Wallet signature-based authentication for humans
- **API Key Auth**: SHA-256 hashed keys with `lsk_` prefix for agents
- **Row Level Security**: All database tables protected with RLS policies
- **Scoped Permissions**: Agents operate within granted scopes only
- **MPC Wallets**: Private keys never leave Coinbase's secure enclave
- **Rate Limiting**: Per-agent rate limits prevent abuse
- **Builder Code Attribution**: All transactions tagged with ERC-8021 builder code

## Builder Code

All on-chain transactions are tagged with Base Builder Code `bc_wdmnog7m` (ERC-8021 format) for analytics visibility in [base.dev](https://base.dev).

## For AI Agents

Loyal Spark is a **machine-payment-native** API. AI agents can discover, authenticate, and pay for API calls without human intervention.

### Discovery Endpoints

| Resource | URL | Purpose |
|----------|-----|---------|
| Agent Manifest | [/.well-known/agent.json](https://loyalspark.online/.well-known/agent.json) | Full protocol spec, capabilities, pricing |
| MPP Manifest | [/.well-known/mpp.json](https://loyalspark.online/.well-known/mpp.json) | Machine Payment Protocol manifest |
| OpenAPI Spec | [/openapi.json](https://loyalspark.online/openapi.json) | OpenAPI 3.1.0 with x-payment-info |
| Skills Library | [/.well-known/skills/](https://loyalspark.online/.well-known/skills/index.md) | 11 step-by-step guides for agents |
| LLMs.txt | [/llms.txt](https://loyalspark.online/llms.txt) | Protocol summary for LLM crawlers |
| Prompt Guide | [PROMPT_GUIDE.md](./PROMPT_GUIDE.md) | Ready-to-use system prompts |

### Payment Gateways (No API Key Needed)

Agents can pay per request using onchain micropayments:

| Protocol | Network | Asset | Gateway |
|----------|---------|-------|---------|
| **x402** | Base | USDC | `https://bzxmejzssxjazswgwqqs.supabase.co/functions/v1/x402-gateway` |
| **MPP** | Tempo | pathUSD / USDC | `https://bzxmejzssxjazswgwqqs.supabase.co/functions/v1/mpp-gateway` |

Pricing: **$0.001–$0.005** per read · **$0.005–$0.05** per write · HTTP 402 challenge/response flow.

### Catalogues & Registries

- **[mpp.dev](https://mpp.dev)** — Machine Payment Protocol registry (PR #474)
- **[mppscan.com](https://mppscan.com)** — MPP service scanner (indexed via OpenAPI)
- **[glama.ai](https://glama.ai)** — MCP server directory
- **[mcp.so](https://mcp.so)** — MCP server registry
- **[smithery.ai](https://smithery.ai)** — MCP marketplace

## Links & Resources

- **Website**: [loyalspark.online](https://loyalspark.online)
- **API Docs**: [loyalspark.online/api-docs](https://loyalspark.online/api-docs)
- **Agent Discovery**: [loyalspark.online/.well-known/agent.json](https://loyalspark.online/.well-known/agent.json)
- **GitHub**: [github.com/aspekt19/unboxed-loyalty-spark](https://github.com/aspekt19/unboxed-loyalty-spark)
- **Twitter/X**: [x.com/Loyal_Spark](https://x.com/Loyal_Spark)
- **Email**: admin@loyalspark.online

## Built With

- [Base](https://base.org) — Ethereum L2 by Coinbase
- [Coinbase CDP](https://docs.cdp.coinbase.com) — MPC Server Wallets
- [Wagmi](https://wagmi.sh) — React Hooks for Ethereum
- [RainbowKit](https://www.rainbowkit.com) — Wallet Connection
- [shadcn/ui](https://ui.shadcn.com) — UI Components
- [Lovable](https://lovable.dev) — Full-Stack Development Platform
- [Viem](https://viem.sh) — TypeScript Interface for Ethereum

## License

MIT License — see LICENSE file for details.
