# Loyal Spark — AI Agent Skills

> Structured step-by-step guides for AI agents interacting with the Loyal Spark onchain loyalty protocol on Base L2.

## Overview

Loyal Spark provides loyalty infrastructure via REST API, MCP Server, and pay-per-request gateways. These skills teach agents how to perform common operations autonomously while matching Base's native B20 semantics.

## Prerequisites

- **API Key**: Open [loyalspark.online/merchant](https://loyalspark.online/merchant) → Sign In → **AI Agents** → register → copy `lsk_...`
- **Authentication**: Pass the key in `x-api-key` for authenticated requests
- **Payment rails**: x402 v2 `exact` with USDC on Base, MPP with published Tempo currencies, or an agent subscription paid in USDC on Base
- **Chain**: Base Mainnet, chain ID `8453`
- **Token standards**: Native B20 Asset (default for new programs) and legacy ERC-20

## Available Skills (16 files: `00`–`15`)

Scopes mirror the REST API: program lifecycle accepts `mint` or `create_program`.

| File | Skill | Scope |
|------|-------|-------|
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
| [11-earn-points.md](./11-earn-points.md) | Earn Points | `mint` |
| [12-gift-certificates.md](./12-gift-certificates.md) | Gift Certificates | `read`, `manage_rewards`, `mint` |
| [13-endpoint-workflows.md](./13-endpoint-workflows.md) | Endpoint Workflows | depends on flow |
| [14-b20-native-spec.md](./14-b20-native-spec.md) | B20 Native Spec (Beryl) | informational |
| [15-payment-scenarios.md](./15-payment-scenarios.md) | Payment Scenarios | depends on rail |

## API and MCP

- **REST**: `https://api.loyalspark.online/agent-api`
- **Merchant MCP**: `https://api.loyalspark.online/loyalty-mcp` (`lsk_`)
- **Recipient MCP**: `https://api.loyalspark.online/recipient-loyalty-mcp` (`rwk_`)

## Operating rule

Do not treat a single endpoint as a complete business action. Create program → broadcast → extract address → register → create reward → mint. B20 is active after registration; legacy ERC-20 additionally needs activation. Voucher redemption requires a confirmed token transfer first.

Read [13-endpoint-workflows.md](./13-endpoint-workflows.md) before orchestrating multi-step actions.

## Discovery

- Agent manifest: `https://loyalspark.online/.well-known/agent.json`
- OpenAPI: `https://loyalspark.online/openapi.json`
- x402 discovery: `https://api.loyalspark.online/.well-known/x402`
- x402 mirror: `https://loyalspark.online/.well-known/x402.json`
- MPP manifest: `https://loyalspark.online/.well-known/mpp.json`
- Skills index: `https://loyalspark.online/.well-known/skills/index.md`

## Pricing (AI agents, `lsk_` keys)

| Plan | Price | API Calls/mo | Agents | Mint fee |
|---|---:|---:|---:|---:|
| Free | $0 | 200 | 1 | 1.25% |
| Pro | $49 USDC | 10,000 | 5 | 0.5% |
| Enterprise | $129 USDC | Unlimited | Unlimited | 0.25% |

The mint fee is paid in the agent's own loyalty tokens as a separate fee mint, not USDC. Subscriptions and x402 / MPP per-call charges are payment-rail charges. See [15-payment-scenarios.md](./15-payment-scenarios.md).
