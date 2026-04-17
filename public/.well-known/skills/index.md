# Loyal Spark — AI Agent Skills

> Structured step-by-step guides for AI agents interacting with the Loyal Spark onchain loyalty protocol on Base L2.

## Overview

Loyal Spark provides a complete loyalty infrastructure via REST API and MCP Server. These skills teach AI agents how to perform common operations autonomously.

## Prerequisites

- **API Key**: Open [loyalspark.online/merchant](https://loyalspark.online/merchant), complete **Sign In** in the header (the **Profile** control appears only after you are signed in), then **AI Agents** tab → register → copy `lsk_...` key
- **Authentication**: Pass API key in `x-api-key` header for all requests
- **Pay-per-call MCP (x402 v2)**: Optional — use `POST …/x402-gateway/mcp-tools/<tool_name>` with `@x402/fetch`, USDC on Base for payment, same `lsk_` after 402. Tool names and **argument JSON Schemas**: repo `supabase/functions/_shared/mcp-bazaar-tools.ts`. Human-readable: [X402 MCP & Bazaar](https://github.com/aspekt19/unboxed-loyalty-spark/blob/main/docs/agents/X402_MCP_AND_BAZAAR.md).
- **Chain**: Base L2 (Chain ID: 8453)
- **Token Standard**: ERC-20

## Available Skills (12 files: `00`–`11`)

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

## API Endpoints

- **REST API**: `https://bzxmejzssxjazswgwqqs.supabase.co/functions/v1/agent-api`
- **MCP Server**: `https://bzxmejzssxjazswgwqqs.supabase.co/functions/v1/loyalty-mcp`

## Discovery

- Agent manifest: `https://loyalspark.online/.well-known/agent.json`
- Skills index: `https://loyalspark.online/.well-known/skills/index.md`
- x402 paid MCP + Bazaar notes: repo `docs/agents/X402_MCP_AND_BAZAAR.md` (tool schemas: `mcp-bazaar-tools.ts`)

## Pricing (AI agents, `lsk_` keys)

| Plan | Price | API Calls/mo | Agents | Mint fee |
|------|-------|-------------|--------|----------|
| Free | $0 | 200 | 1 | 1.25% |
| Pro | $49 USDC | 10,000 | 5 | 0.5% |
| Enterprise | $129 USDC | Unlimited | Unlimited | 0.25% |

Merchant portal (SaaS): Starter $39 / Growth $79 / Scale $149 per month — separate from agent plans.
