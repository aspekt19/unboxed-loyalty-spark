# Loyal Spark — AI Agent Skills

> Structured step-by-step guides for AI agents interacting with the Loyal Spark onchain loyalty protocol on Base L2.

## Overview

Loyal Spark provides a complete loyalty infrastructure via REST API and MCP Server. These skills teach AI agents how to perform common operations autonomously.

## Prerequisites

- **API Key**: Open [loyalspark.online/merchant](https://loyalspark.online/merchant), complete **Sign In** in the header (the **Profile** control appears only after you are signed in), then **AI Agents** tab → register → copy `lsk_...` key
- **Authentication**: Pass API key in `x-api-key` header for all requests
- **Pay-per-call MCP (x402 v2)**: Optional — merchant: `POST …/x402-gateway/mcp-tools/<tool_name>` (`lsk_`); recipient/holder: `POST …/x402-gateway/recipient-mcp-tools/<tool_name>` (`rwk_`). Use `@x402/fetch` + USDC on Base. Schemas: `mcp-bazaar-tools.ts` · `recipient-mcp-bazaar-tools.ts`; HTTP **402** + **Bazaar** metadata: `x402-bazaar-accept.ts`.
- **Chain**: Base L2 (Chain ID: 8453)
- **Token Standard**: ERC-20

## Available Skills (13 files: `00`–`12`)

Scopes mirror the REST API: program lifecycle accepts **`mint` or `create_program`**.

| File | Skill | Scopes required |
|------|-------|-----------------|
| [00-getting-started.md](./00-getting-started.md) | Getting Started | — |
| [01-create-loyalty-program.md](./01-create-loyalty-program.md) | Create Loyalty Program | `mint` or `create_program` |
| [02-mint-tokens.md](./02-mint-tokens.md) | Mint Tokens | `mint` |
| [03-transfer-tokens.md](./03-transfer-tokens.md) | Transfer Tokens | `mint` |
| [04-manage-rewards.md](./04-manage-rewards.md) | Manage Rewards | `manage_rewards` |
| [05-balance-and-tiers.md](./05-balance-and-tiers.md) | Balance & Tiers | `read` |
| [06-marketplace-trading.md](./06-marketplace-trading.md) | Marketplace Trading | `trade` |
| [07-analytics-crm.md](./07-analytics-crm.md) | Analytics & CRM | `read` |
| [08-referrals.md](./08-referrals.md) | Referral Programs | `read`, `mint` |
| [09-vouchers.md](./09-vouchers.md) | Voucher Management | `read`, `manage_rewards` |
| [10-server-wallets.md](./10-server-wallets.md) | Server Wallets (CDP MPC) | — |
| [11-earn-points.md](./11-earn-points.md) | Earn Points (Cashback) | `mint` |
| [12-gift-certificates.md](./12-gift-certificates.md) | Gift Certificates (LOYAL-XXXXXX) | `read`, `manage_rewards`, `mint` |

## API Endpoints

- **REST API**: `https://api.loyalspark.online/agent-api`
- **MCP Server**: `https://api.loyalspark.online/loyalty-mcp`

## Discovery

- Agent manifest: `https://loyalspark.online/.well-known/agent.json`
- Skills index: `https://loyalspark.online/.well-known/skills/index.md`
- x402 paid MCP: `mcp-bazaar-tools.ts` · `recipient-mcp-bazaar-tools.ts` · `x402-bazaar-accept.ts`

## Pricing (AI agents, `lsk_` keys)

| Plan | Price | API Calls/mo | Agents | Mint fee |
|------|-------|-------------|--------|----------|
| Free | $0 | 200 | 1 | 1.25% |
| Pro | $49 USDC | 10,000 | 5 | 0.5% |
| Enterprise | $129 USDC | Unlimited | Unlimited | 0.25% |

Merchant portal (SaaS): Starter $39 / Growth $79 / Scale $149 per month — separate from agent plans.
