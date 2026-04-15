# Agent-to-Agent (A2A) Loyalty Protocol — Architecture

## Status: Implemented ✅

The Loyal Spark platform operates as a dual-mode protocol where **humans** interact via the web UI (Privy for email/phone/Google + SIWE for Farcaster/crypto-native), and **AI agents** interact via REST API or MCP Server — sharing the same database, smart contracts, and tokens.

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
│  │       Backend (Edge Functions)            │    │
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

---

## Implemented Components

### 1. Agent Registry & API Keys ✅
- **Table**: `agent_registry` — stores agent metadata, hashed API keys, scopes, rate limits
- **Table**: `agent_activity_log` — full audit trail of all agent actions
- **Edge Function**: `agent-api-key` — generates `lsk_` prefixed API keys (SHA-256 hashed)
- **Scopes**: `read`, `mint`, `manage_rewards`, `create_program`, `trade`

### 2. REST API ✅
- **Edge Function**: `agent-api` — single function with routing
- **Endpoints**: `/programs`, `/rewards`, `/mint`, `/balance`, `/customers`, `/analytics`, `/offers`, `/me`
- **Auth**: `x-api-key` header with scope verification

### 3. MCP Server ✅
- **Edge Function**: `loyalty-mcp` — Streamable HTTP transport, JSON-RPC 2.0
- **10 Tools**: `get_platform_info`, `get_my_profile`, `list_loyalty_programs`, `list_rewards`, `create_reward`, `mint_loyalty_tokens`, `transfer_loyalty_tokens`, `get_token_balance`, `get_program_analytics`, `list_marketplace_offers`
- **Compatible with**: Claude Desktop, Cursor, VS Code, any MCP client

### 4. CDP Server Wallets (MPC) ✅
- **Edge Function**: `agent-wallet` — creates and manages Coinbase MPC wallets
- **Actions**: `create_server_wallet`, `server_mint`, `sign_transaction`
- **Auth**: Direct REST API calls to CDP v2 (no heavy SDK)
- **JWT**: Ed25519 Bearer token + ES256 X-Wallet-Auth for write operations
- **Table**: `agent_wallets` — stores wallet addresses linked to agents

### 5. Monetization ✅
- **Transaction Fees**: 1.25% (Free), 0.5% (Pro), 0.25% (Enterprise) — collected during `server_mint`
- **SaaS Plans (agents)**: Free ($0), Pro ($49/mo USDC), Enterprise ($129/mo USDC) — see `docs/business/MONETIZATION_AND_PRICING.md`
- **Payment**: On-chain USDC transfer verification via BaseScan API
- **Tables**: `agent_plans`, `agent_plan_subscriptions`, `agent_usage`, `agent_fee_log`
- **Edge Function**: `verify-agent-plan-payment` — verifies USDC Transfer events on-chain for **agent** plans (`product` default) and **merchant** SaaS plans (`product: "merchant"`); same treasury wallet as agents

### 6. Builder Code Attribution ✅
- **Code**: `bc_wdmnog7m` (ERC-8021 format)
- **Applied to**: All CDP wallet transactions (mint, sign)
- **Visible in**: [base.dev](https://base.dev) analytics

### 7. UI Components ✅
- **AgentManagement** — register agents, manage keys, configure scopes
- **AgentActivityLog** — view agent operation history
- **AgentBillingDashboard** — plan management, usage stats, upgrade flow
- **MerchantPanel** — "AI Agents" tab in merchant dashboard

### 8. Discovery & Documentation ✅
- **Agent Card**: `/.well-known/agent.json` — protocol specification for AI discovery
- **Skills**: `/.well-known/skills/` — 11 structured Markdown guides for agent onboarding (getting started, mint, transfer, rewards, tiers, marketplace, analytics, referrals, vouchers, wallets)
- **API Docs**: `/api-docs` — interactive documentation with MCP setup
- **MCP Server section** with setup instructions for Claude, Cursor, Python SDK

---

## Compatibility Matrix

| Feature | Humans (UI) | Agents (API/MCP) |
|---------|-------------|------------------|
| Authentication | Privy (email/phone/Google) + SIWE (Farcaster) | API key (`x-api-key`) |
| Wallet | Privy embedded wallet / MetaMask / WalletConnect | CDP Server Wallet (MPC) |
| Create program | UI form → browser wallet | POST `/programs` → CDP |
| Mint tokens | Form → browser wallet signs | POST `/mint` → CDP signs |
| View data | React components | GET endpoints / MCP tools |
| Marketplace | UI cards | POST `/marketplace/offer` |
| Data | Shared database, same tables |
| Contracts | Same smart contracts on Base |
| Tokens | Same ERC-20 tokens |

---

## Future Roadmap

- [ ] Webhooks for agent event notifications
- [ ] Agent-to-Agent token exchange marketplace
- [ ] Automation rules via API
- [ ] Multi-chain support
- [ ] Native protocol token for governance
