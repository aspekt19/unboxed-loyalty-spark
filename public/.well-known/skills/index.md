# Loyal Spark — AI Agent Skills

> Structured step-by-step guides for AI agents interacting with the Loyal Spark onchain loyalty protocol on Base L2.

## Overview

Loyal Spark provides a complete loyalty infrastructure via REST API and MCP Server. These skills teach AI agents how to perform common operations autonomously.

## Prerequisites

- **API Key**: Register at [loyalspark.online/merchant](https://loyalspark.online/merchant) → AI Agents tab → Get `lsk_...` key
- **Authentication**: Pass API key in `x-api-key` header for all requests
- **Chain**: Base L2 (Chain ID: 8453)
- **Token Standard**: ERC-20

## Available Skills

| # | Skill | File | Scopes Required |
|---|-------|------|-----------------|
| 1 | [Getting Started](./00-getting-started.md) | `00-getting-started.md` | — |
| 2 | [Create Loyalty Program](./01-create-loyalty-program.md) | `01-create-loyalty-program.md` | `create_program` |
| 3 | [Mint Tokens](./02-mint-tokens.md) | `02-mint-tokens.md` | `mint` |
| 4 | [Transfer Tokens](./03-transfer-tokens.md) | `03-transfer-tokens.md` | `mint` |
| 5 | [Manage Rewards](./04-manage-rewards.md) | `04-manage-rewards.md` | `manage_rewards` |
| 6 | [Check Balance & Tiers](./05-balance-and-tiers.md) | `05-balance-and-tiers.md` | `read` |
| 7 | [Marketplace Trading](./06-marketplace-trading.md) | `06-marketplace-trading.md` | `trade` |
| 8 | [Analytics & CRM](./07-analytics-crm.md) | `07-analytics-crm.md` | `read` |
| 9 | [Referral Programs](./08-referrals.md) | `08-referrals.md` | `read`, `mint` |
| 10 | [Voucher Management](./09-vouchers.md) | `09-vouchers.md` | `read`, `manage_rewards` |
| 11 | [Server Wallets](./10-server-wallets.md) | `10-server-wallets.md` | — |

## API Endpoints

- **REST API**: `https://bzxmejzssxjazswgwqqs.supabase.co/functions/v1/agent-api`
- **MCP Server**: `https://bzxmejzssxjazswgwqqs.supabase.co/functions/v1/loyalty-mcp`

## Discovery

- Agent manifest: `https://loyalspark.online/.well-known/agent.json`
- Skills index: `https://loyalspark.online/.well-known/skills/index.md`

## Pricing

| Plan | Price | API Calls/mo | Agents | Tx Fee |
|------|-------|-------------|--------|--------|
| Free | $0 | 100 | 1 | 1% |
| Pro | $29 USDC | 10,000 | 5 | 0.5% |
| Enterprise | $99 USDC | Unlimited | Unlimited | 0.25% |
