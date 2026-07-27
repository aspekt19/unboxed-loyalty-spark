# Loyal Spark — Onchain Loyalty Protocol

A Web3-powered loyalty platform built on **Base Mainnet**, enabling merchants and AI agents to create custom loyalty token programs while customers earn rewards that automatically invest and grow through DeFi.

## Overview

Loyal Spark revolutionizes traditional loyalty programs by bringing them onchain. It operates as a **dual-mode platform**: humans interact via the web UI with flexible authentication (email, phone, social login, or wallet), while AI agents interact via REST API or MCP Server — sharing the same database, smart contracts, and tokens.

**Wallet Abstraction**: Users and merchants sign in via [Privy](https://privy.io) — email, phone/SMS, Google, or external wallets (MetaMask, WalletConnect, Coinbase Wallet). Privy automatically creates an embedded wallet on Base — no crypto experience needed. Farcaster miniapp and SIWE for crypto-native users are also fully supported. Merchants can send tokens to customers by email or phone number (resolved to wallet address automatically).

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
- **Deploy Loyalty Tokens**: Create custom loyalty tokens on Base (**B20 default**; legacy ERC-20 via API)
- **Mint Tokens**: Issue loyalty points to customers via wallet addresses or QR scan
- **Create Rewards**: Design voucher rewards with token costs
- **CRM & Analytics**: Customer profiles, RFM segmentation, tier management
- **Marketing Automation**: Automated campaigns, personalized offers
- **Referral Programs**: Generate referral codes with bonuses
- **Voucher Management**: Track redemptions with QR code verification
- **AI Agent Management**: Register agents, manage API keys, monitor activity
- **Team & branches**: Invite cashiers/managers by wallet or **one-time invite code** (redeem on **Merchant → Team**); requires Postgres RPC `accept_merchant_invite` — see [docs/development/PORTALS_AND_TEAM.md](./docs/development/PORTALS_AND_TEAM.md)

### For Customers (Web UI)
- **Multi-Token Dashboard**: View all loyalty tokens from different merchants
- **Browse Rewards**: Explore available vouchers across all programs
- **Redeem Vouchers**: Burn tokens to claim exclusive rewards with QR codes
- **DEX Trading**: Trade loyalty tokens on decentralized exchanges *(module frozen in this repo — no new work in `marketplace/`)*  
- **Round-Up Investment**: Automatically invest spare change into DeFi *(module frozen in this repo — no new work in `roundup/`)*  
- **Tier System**: Bronze → Silver → Gold → Platinum with increasing perks

### For AI Agents (REST API + MCP)
- **Full CRUD via API**: Create programs, mint tokens, manage rewards, view analytics
- **MCP Server**: Connect Claude, GPT, Cursor, or any MCP-compatible LLM directly
- **Server Wallets**: Coinbase CDP MPC wallets for autonomous onchain operations
- **Scoped Permissions**: Granular access control (read, mint, manage_rewards, trade)
- **Activity Logging**: Full audit trail of all agent operations
- **Tiered Pricing (agents)**: Free (200 calls/mo, 1.25% mint fee) → Pro ($49/mo, 0.5%) → Enterprise ($129/mo, 0.25%) — see [docs/business/MONETIZATION_AND_PRICING.md](./docs/business/MONETIZATION_AND_PRICING.md)
- **Skills Documentation**: 13 structured step-by-step guides (`00`–`12` under `/.well-known/skills/`) for agent onboarding and operations

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui (Radix) |
| Animations | Framer Motion |
| Blockchain | Wagmi v2, Viem, RainbowKit, Privy (`@privy-io/react-auth` + `@privy-io/wagmi`) |
| Network | Base Mainnet (Chain ID: 8453) |
| Smart Contracts | ERC-20 Token Standard (Factory pattern) |
| Backend | Supabase (PostgreSQL, RLS, Deno Edge Functions, Realtime) |
| Native apps | Capacitor 8 (iOS / Android) — see `docs/development/NATIVE_BUILD_GUIDE.md` |
| Agent Wallets | Coinbase CDP MPC (Server Wallets) |
| State | TanStack Query v5 |
| Routing | React Router DOM v6 |
| Forms | React Hook Form + Zod validation |
| Builder Attribution | Base Builder Code (ERC-8021) |

## Smart Contract Architecture

**New loyalty programs (default)** deploy via Base’s native **B20** factory precompile — one transaction, active immediately after `register-program`. **Legacy** programs use the Loyal Spark ERC-20 factory below (`token_standard: "erc20"` in API only). Full flows: **[docs/development/LOYALTY_PROGRAM_CONTRACTS.md](./docs/development/LOYALTY_PROGRAM_CONTRACTS.md)**.

| Role | Address | When |
|------|---------|------|
| **B20 Factory** (Base precompile) | `0xB20f000000000000000000000000000000000000` | **Default** — `createB20` → token `0xB200…` |
| **LoyaltyTokenFactory** (legacy) | `0x5F3DdBa12580CFdc6016258774cCc19C4250dA80` | Opt-in `erc20` — `createLoyaltyToken` + activation |
| **LoyalSparkERC20 (implementation)** | `0xe6BA426C9c51281B929a17444De02c65815E27C3` | Logic for legacy proxy tokens |
| **LoyaltyTokenEscrow** (P2P) | `0xA569C95AfC1BCF381c48BcF336ED9D2c014bcdDF` | Marketplace swaps |

**Network**: Base Mainnet (Chain ID: 8453)

### Program creation (summary)

| Path | Deploy | Activate | Portal |
|------|--------|----------|--------|
| **B20** (default) | 1× `createB20` on `0xB20f…` | Not required | Yes |
| **Legacy ERC-20** | 1× `createLoyaltyToken` on `0x5F3DdB…` | `unpauseUtility` + `enableMinting` | API only |

### Token operations (both standards)

B20 tokens are ERC-20–compatible for balances, transfers, mint, and escrow:

- `mint(address to, uint256 amount)` — issue points (role-gated)
- `transfer` / `transferFrom` — move tokens between wallets
- `balanceOf(address)` — query balance

## AI Agent Integration

### Quick Start

**Merchant dashboard:**  
1. Go to [loyalspark.online/merchant](https://loyalspark.online/merchant) and sign in (email, phone, Google, or wallet via Privy)  
2. Open **AI Agents** tab → Register an agent → Copy your API key (`lsk_...`)  
3. Use the key in `x-api-key` header for REST or MCP calls  

**Without the web app (autonomous agents):** free **`lsk_`** via wallet signature — Edge Function `agent-register-siwe` + nonce from `siwe-nonce`. See **[docs/agents/AUTONOMOUS_AGENT_REGISTRATION.md](./docs/agents/AUTONOMOUS_AGENT_REGISTRATION.md)** and **[docs/agents/QUICKSTART.md](./docs/agents/QUICKSTART.md)**.

### Optional repo scripts (development / agent onboarding)

These directories are **not** imported by the web app; they are optional helpers for developers and agents reproducing flows locally. Secrets stay in environment variables only.

| Folder | Purpose |
|--------|---------|
| [`scripts/x402-paid-mcp-test/`](./scripts/x402-paid-mcp-test/) | Smoke test: paid MCP via **x402** (USDC on Base, `@x402/fetch`). |
| [`scripts/x402-paid-agent-api/`](./scripts/x402-paid-agent-api/) | Same stack, paid **agent-api** routes (`GET/POST` to `x402-gateway/<resource>`). |
| [`scripts/traffic-bot-x402-bridge.py`](./scripts/traffic-bot-x402-bridge.py) | Example **Python → Node** subprocess hook for bots that already send loyalty txs on Base. |
| [`scripts/agent-register-siwe/`](./scripts/agent-register-siwe/) | Helper: build SIWE message + sign + call **`agent-register-siwe`** (same as production). |

Schemas for paid MCP: merchant **`mcp-tools/<name>`** — **[mcp-bazaar-tools.ts](./supabase/functions/_shared/mcp-bazaar-tools.ts)**; recipient **`recipient-mcp-tools/<name>`** — **[recipient-mcp-bazaar-tools.ts](./supabase/functions/_shared/recipient-mcp-bazaar-tools.ts)**. HTTP **402** `accepts` + Coinbase **x402 Bazaar** discovery metadata for all paid routes are built in **[x402-bazaar-accept.ts](./supabase/functions/_shared/x402-bazaar-accept.ts)**. These scripts are **not** linked from the marketing homepage; primary onboarding remains [/for-agents](https://loyalspark.online/for-agents) and the merchant portal.

### REST API

```bash
# List loyalty programs
curl -H "x-api-key: lsk_YOUR_KEY" \
  https://api.loyalspark.online/agent-api/programs

# Mint tokens (1.25% mint fee on Free plan)
curl -X POST \
  -H "x-api-key: lsk_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"token_address":"0x...","recipient":"0x...","amount":100}' \
  https://api.loyalspark.online/agent-api/mint
```

### API Endpoints (27 authenticated + 1 public)

All routes below require `x-api-key: lsk_...` except **GET `/vouchers/status`** (public).

| Method | Path | Scope | Description |
|--------|------|-------|-------------|
| GET | `/me` | authenticated | Agent profile & permissions |
| GET | `/workflow/program-status` | read | Autonomous planner: lifecycle step + `next_actions[]` |
| GET | `/programs` | read | List loyalty programs |
| POST | `/workflow/generate-program-defaults` | mint | Propose program name, symbol, economics, and starter rewards from business context |
| POST | `/programs` | mint or `create_program` | Calldata to deploy loyalty token (**B20 default**, or legacy ERC-20 with `token_standard: "erc20"`) |
| POST | `/register-program` | mint or `create_program` | Register deployed token (optional `cashback_rate`, `points_per_dollar`) |
| POST | `/update-program-config` | mint or `create_program` | Update `cashback_rate` / `points_per_dollar` for a program |
| POST | `/activate-program` | mint or `create_program` | Legacy ERC-20 activation only (no-op for B20) |
| POST | `/program-status` | mint or `create_program` | Update program status |
| GET | `/rewards` | read | List rewards |
| POST | `/rewards` | manage_rewards | Create reward |
| POST | `/mint` | mint | Mint tokens |
| POST | `/earn` | mint | Cashback: mint from purchase amount × rate |
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
| GET | `/tx-receipt` | authenticated | Extract token_address from deploy tx |
| GET | `/merchant-profile` | read | Read merchant profile |
| POST | `/merchant-profile` | manage_rewards | Create merchant profile |
| PUT | `/merchant-profile` | manage_rewards | Update merchant profile |

### MCP Server (for LLMs)

Connect Claude, GPT, or any MCP-compatible agent:

```json
{
  "mcpServers": {
    "loyal-spark": {
      "url": "https://api.loyalspark.online/loyalty-mcp",
      "headers": {
        "x-api-key": "lsk_YOUR_KEY"
      }
    }
  }
}
```

**MCP tools (38)** — defined in `supabase/functions/loyalty-mcp/index.ts`:  
`get_platform_info`, `get_my_profile`, `generate_program_defaults`, `get_program_workflow_status`, `list_loyalty_programs`, `create_loyalty_program`, `register_loyalty_program`, `activate_loyalty_program`, `update_program_status`, `update_program_config`, `list_rewards`, `create_reward`, `mint_loyalty_tokens`, `transfer_loyalty_tokens`, `earn_points`, `get_token_balance`, `get_program_analytics`, `list_marketplace_offers`, `redeem_reward`, `use_voucher`, `check_voucher_status`, `get_platform_stats`, `cancel_stale_offers`, `create_personalized_offer`, `update_reward_status`, `export_customers`, `send_report`, `list_my_reports`, `update_report_status`, `delete_report`, `create_gift_certificate`, `list_gift_certificates`, `revoke_gift_certificate`, `mark_gift_certificate_minted`, `bazaar_discover_resources`, `bazaar_discover_mcp_servers`, `bazaar_probe_x402`, `bazaar_pay_and_call` (last four = Bazaar side-car for outbound x402 discovery + signed payments).

### Base MCP custom plugin (`send_calls`-ready calldata)

For AI users already connected to **Base MCP** (`mcp.base.org`), Loyal Spark ships GET-friendly calldata endpoints at `https://api.loyalspark.online/agent-prepare/*`. Each response returns a `send_calls`-compatible transaction batch with Builder Code `bc_wdmnog7m` already appended (ERC-8021). Base Account signs and broadcasts.

Actions: `create-program`, `activate-program`, `mint`, `transfer` (merchant, `lsk_`) · `recipient-transfer`, `recipient-approve` (holder, `rwk_`).

```bash
# Prepare a mint (returns { transactions: [{to,data,value}], … } for send_calls)
curl -H "x-api-key: lsk_YOUR_KEY" \
  "https://api.loyalspark.online/agent-prepare/mint?token=0xTOKEN&to=0xCUSTOMER&amount=100"
```

Plugin spec: [`skills/loyal-spark/plugins/loyal-spark.md`](./skills/loyal-spark/plugins/loyal-spark.md).

### Recipient agents (wallet holders, `rwk_`)

For **AI agents that only hold a wallet** which receives loyalty tokens (not merchant operators). Humans are unchanged; this is an optional machine path.

| Piece | URL / path |
|-------|----------------|
| REST | `https://api.loyalspark.online/recipient-api` |
| MCP | `https://api.loyalspark.online/recipient-loyalty-mcp` |
| Register key | `POST …/recipient-api/register` with SIWE `{ message, signature }` (nonce from `siwe-nonce`) — returns `rwk_…` once. Pass Supabase `apikey` (anon/publishable) header like other public functions. |

**REST (all require `x-api-key: rwk_…` except register):** `GET /me`, `GET /balances`, `GET /balance?token_address=`, `GET /rewards?token_address=`, `GET /vouchers`, `POST /redeem-reward` with `{ reward_id, transaction_hash }` (customer is always the bound wallet), **`POST /prepare-transfer`** with `{ token_address, to, amount }` — ERC-20 transfer calldata so the bound wallet can send loyalty tokens to any address (same encoding as merchant `transfer_loyalty_tokens`; sign on Base). **P2P:** `GET /offers?token_address=`, `POST /offers`, `POST /accept-offer`, `POST /cancel-offer` (same bodies as merchant `agent-api` marketplace; `creator_address` is the bound wallet).

**MCP tools (20)** — `supabase/functions/recipient-loyalty-mcp/index.ts`: `get_recipient_profile`, `list_my_loyalty_balances`, `get_my_loyalty_balance`, `get_reward_workflow_status`, `prepare_reward_redemption`, `prepare_loyalty_token_transfer`, `list_rewards_for_program`, `list_my_vouchers`, `redeem_my_reward`, `list_p2p_offers`, `create_p2p_offer`, `accept_p2p_offer`, `cancel_p2p_offer`, `lookup_gift_certificate`, `claim_gift_certificate`, `list_my_gift_certificates`, `bazaar_discover_resources`, `bazaar_discover_mcp_servers`, `bazaar_probe_x402`, `bazaar_pay_and_call` (last four = Bazaar side-car; `bazaar_pay_and_call` requires opt-in delegated CDP wallet).

**Pay-per-call (recipient, MPP / x402):** Autonomous agents that should pay USDC per request use the same gateways as merchants: **`mpp-gateway/recipient-api/…`** (Tempo MPP) or **`x402-gateway/recipient-api/…`** and **`x402-gateway/recipient-mcp-tools/<tool>`** (x402). USD prices match the merchant corridor (reads **~$0.001**, writes **~$0.005–0.01**; `prepare-transfer` / `prepare_loyalty_token_transfer` **$0.005**). Canonical tables: [`docs/business/MONETIZATION_AND_PRICING.md`](./docs/business/MONETIZATION_AND_PRICING.md) §4.1 · source constants: `supabase/functions/_shared/recipient-paid-routes.ts`, `recipient-mcp-bazaar-tools.ts`. Direct `functions/v1/recipient-api` / `recipient-loyalty-mcp` calls use **`rwk_`** + rate limits only (no per-request USDC in the gateway layer).

Example MCP fragment: [`examples/recipient-agent-mcp/cursor-mcp.json`](./examples/recipient-agent-mcp/cursor-mcp.json).

### Agent Discovery

AI agents can discover the protocol automatically via:
- `/.well-known/agent.json` — Full protocol specification, capabilities, pricing
- `/.well-known/skills/` — 13 structured Skills (`00`–`12`, step-by-step guides)
- `/api-docs` — Interactive API documentation

### Skills for AI Agents

Structured Markdown guides that teach agents how to use the protocol:

| # | Skill | Description |
|---|-------|-------------|
| 00 | Getting Started | Register agent (merchant UI or SIWE), get `lsk_`, first request |
| 01 | Create Loyalty Program | Deploy B20 loyalty token on Base (legacy ERC-20 optional) |
| 02 | Mint Tokens | Mint tokens to customer wallets |
| 03 | Transfer Tokens | Transfer tokens between wallets |
| 04 | Manage Rewards | Create redeemable rewards catalog |
| 05 | Balance & Tiers | Check balances and tier status |
| 06 | Marketplace Trading | P2P token trading with atomic escrow |
| 07 | Analytics & CRM | Program analytics and CRM data |
| 08 | Referrals | Referral programs for organic growth |
| 09 | Vouchers | Voucher lifecycle management |
| 10 | Server Wallets | CDP MPC wallets for autonomous transactions |
| 11 | Earn Points (Cashback) | Mint from purchase amount × cashback rate |

Skills index: `https://loyalspark.online/.well-known/skills/index.md`

### Server Wallets (CDP MPC)

Agents can create their own Coinbase MPC wallets on Base for autonomous transactions:

```bash
curl -X POST \
  -H "x-api-key: lsk_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"action":"create_server_wallet"}' \
  https://api.loyalspark.online/agent-wallet
```

Benefits:
- No private key management — keys are in Coinbase's secure enclave
- Server-side transaction signing
- Automatic Builder Code attribution (ERC-8021)

### Pricing

| Plan | Monthly | API Calls | Agents | Mint fee |
|------|---------|-----------|--------|----------|
| Free | $0 | 200 | 1 | 1.25% |
| Pro | $49 USDC | 10,000 | 5 | 0.5% |
| Enterprise | $129 USDC | Unlimited | Unlimited | 0.25% |

**Merchant SaaS (portal):** Starter **$39** / Growth **$79** / Scale **$149** per month (annual discount 15–20% optional) — details in [docs/business/MONETIZATION_AND_PRICING.md](./docs/business/MONETIZATION_AND_PRICING.md).

Payments for agent plans on-chain in USDC on Base ($1 = 1 USDC).

## Getting Started

### Prerequisites
- Node.js 18+ or Bun
- An email, phone number, Google account, or Web3 wallet (MetaMask, Coinbase Wallet, WalletConnect)
- Some ETH on Base for gas fees (merchants only)

### Installation

```bash
git clone https://github.com/aspekt19/unboxed-loyalty-spark.git
cd unboxed-loyalty-spark
npm install
npm run dev
```

### Sign In Options

- **Email / Phone / Google** (recommended): Click "Sign In" via Privy — an embedded wallet is created automatically, no crypto knowledge needed
- **MetaMask / Coinbase Wallet / WalletConnect**: Traditional Web3 wallet connection
- **Farcaster**: Auto-connects inside Warpcast miniapp

On **Merchant** and **Customer** portals, use the header **Sign In** / wallet control until a session exists; the **Profile** control appears only after you are signed in. See [docs/development/PORTALS_AND_TEAM.md](./docs/development/PORTALS_AND_TEAM.md).

**Network**: Base Mainnet (Chain ID: 8453) | **RPC**: https://mainnet.base.org | **Explorer**: https://basescan.org

## Project Structure

```
unboxed-loyalty-spark/
├── AGENTS.md                      # Entry map for AI / coding agents
├── docs/                          # Human docs (guides, integrations, pitch notes)
│   ├── development/               # Build & deploy
│   ├── integrations/              # Farcaster, OpenServ, A2A, prompts
│   ├── pitch-deck/                # Investor deck (Markdown sources)
│   └── supabase/                  # DB/edge runbooks
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
│   │   ├── merchant/              # Merchant shell & tabs (Team, Programs, …)
│   │   ├── team/                  # Branches, employees, invite redemption
│   │   └── admin/                 # Platform administration
│   ├── hooks/                     # Data fetching (TanStack Query + Supabase) — keep queries here
│   ├── config/                    # Contract addresses & ABIs
│   ├── contexts/                  # Auth context
│   ├── integrations/supabase/     # Database client & types
│   ├── pages/                     # Routes (e.g. ForAgentsPage → /for-agents, ApiDocsPage → /api-docs)
│   └── lib/                       # Utilities
├── examples/agent-mcp/            # Copy-paste MCP + curl for agents
├── scripts/                       # Optional dev helpers (x402 MCP smoke test, SIWE lsk_ helper) — not bundled in the web app
├── public/
│   ├── .well-known/
│   │   ├── agent.json             # AI agent discovery
│   │   ├── skills/                # Markdown skills for agents (00–12)
│   │   └── farcaster.json         # Farcaster manifest
│   ├── openapi.json               # OpenAPI 3.1 (API + x402 hints)
│   ├── llms.txt / llms-full.txt   # Short / long summaries for LLM crawlers
│   └── media-kit/                 # Brand & press assets
├── capacitor.config.ts            # Native app IDs (see docs/development/)
├── contracts/                     # Solidity contracts
├── supabase/
│   ├── functions/                 # Edge Functions — see supabase/functions/README.md
│   └── migrations/                # Database migrations
└── README.md
```

**Indexes:** [AGENTS.md](./AGENTS.md) (AI agents) · [docs/README.md](./docs/README.md) (human guides) · [docs/development/PORTALS_AND_TEAM.md](./docs/development/PORTALS_AND_TEAM.md) (portal UI & team invites) · [supabase/functions/README.md](./supabase/functions/README.md) (Edge Functions).

## Edge Functions

See the **[supabase/functions/README.md](./supabase/functions/README.md)** catalogue (grouped by role: API, MCP, auth, payments, jobs). The root README table is intentionally shortened here to avoid duplication.

## Security

- **Flexible Authentication**: Email/phone/Google via Privy (with embedded wallets), or SIWE for Farcaster and crypto-native users
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
| **Agent onboarding (web)** | [/for-agents](https://loyalspark.online/for-agents) | Keys, REST, MCP, gateways, discovery — one page for builders |
| Agent Manifest | [/.well-known/agent.json](https://loyalspark.online/.well-known/agent.json) | Full protocol spec, capabilities, pricing |
| MPP Manifest | [/.well-known/mpp.json](https://loyalspark.online/.well-known/mpp.json) | Machine Payment Protocol manifest |
| OpenAPI Spec | [/openapi.json](https://loyalspark.online/openapi.json) | OpenAPI 3.1.0 with x-payment-info |
| Skills Library | [/.well-known/skills/](https://loyalspark.online/.well-known/skills/index.md) | 13 step-by-step guides for agents (`00`–`12`) |
| LLMs.txt | [/llms.txt](https://loyalspark.online/llms.txt) | Protocol summary for LLM crawlers |
| Prompt Guide | [PROMPT_GUIDE.md](./docs/integrations/PROMPT_GUIDE.md) | Ready-to-use system prompts |
| Copy-paste MCP / curl | [examples/agent-mcp/](./examples/agent-mcp/) | Starter configs in the repo |
| Repo quickstart (keys, SIWE, x402) | [docs/agents/QUICKSTART.md](./docs/agents/QUICKSTART.md) | Short paths for coding agents |

### Payment Gateways (No API Key Needed)

Agents can pay per request using onchain micropayments:

| Protocol | Network | Asset | Gateway |
|----------|---------|-------|---------|
| **x402** | Base | USDC | `https://api.loyalspark.online/x402-gateway` |
| **MPP** | Tempo | pathUSD / USDC | `https://api.loyalspark.online/mpp-gateway` |

Pricing: **$0.001–$0.005** per read · **$0.005–$0.05** per write · HTTP 402 challenge/response flow.

**Paid MCP (merchant):** `POST …/x402-gateway/mcp-tools/<tool_name>` (JSON-RPC `tools/call`); after settlement, pass **`x-api-key: lsk_…`** like direct MCP. **Recipient / holder MCP:** `POST …/x402-gateway/recipient-mcp-tools/<tool_name>` with **`x-api-key: rwk_…`**. Tool lists + JSON Schemas: **`mcp-bazaar-tools.ts`** · **`recipient-mcp-bazaar-tools.ts`**. **402 + Bazaar (discovery) metadata** for both families: **`x402-bazaar-accept.ts`** (`extensions.bazaar`, `outputSchema.input.type: "mcp"`). After successful settle, the CDP facilitator may return **`EXTENSION-RESPONSES`** (`bazaar.status`: success | processing | rejected).

### Catalogues & Registries

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
- [Privy](https://privy.io) — Wallet Abstraction & Authentication
- [Coinbase CDP](https://docs.cdp.coinbase.com) — MPC Server Wallets (for AI agents)
- [Wagmi](https://wagmi.sh) — React Hooks for Ethereum
- [shadcn/ui](https://ui.shadcn.com) — UI Components
- [Lovable](https://lovable.dev) — Full-Stack Development Platform
- [Viem](https://viem.sh) — TypeScript Interface for Ethereum

## License

MIT License — see LICENSE file for details.
