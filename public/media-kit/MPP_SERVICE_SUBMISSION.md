# How to Add Loyal Spark to mpp.dev Service Catalog

## Prerequisites
- GitHub account
- Working MPP gateway endpoint (verified ✅)
- Your service must be **live and accepting payments** via MPP

## Step-by-Step Instructions

### 1. Fork the Repository
Go to https://github.com/tempoxyz/mpp and click **Fork**.

### 2. Clone Your Fork
```bash
git clone https://github.com/YOUR_USERNAME/mpp.git
cd mpp
pnpm install
```

### 3. Edit `schemas/services.ts`

Add the following entry to the `services` array (place alphabetically among existing services):

```typescript
// ── Loyal Spark ─────────────────────────────────────────────────────────
{
  id: "loyal-spark",
  name: "Loyal Spark",
  url: "https://loyalspark.online",
  serviceUrl: "https://api.loyalspark.online/mpp-gateway",
  description: "Onchain loyalty protocol for AI agents — create B20 programs by default (legacy ERC-20 optional), mint tokens, manage rewards, trade on P2P marketplace, and get autonomous MPC wallets. All on Base L2.",
  categories: ["blockchain"] as Category[],
  integration: "first-party" as Integration,
  tags: [
    "loyalty",
    "rewards",
    "erc20",
    "base",
    "defi",
    "marketplace",
    "mcp",
    "ai-agents",
    "mpc-wallet",
  ],
  docs: {
    homepage: "https://loyalspark.online/api-docs",
    llmsTxt: "https://loyalspark.online/llms.txt",
  },
  provider: { name: "Loyal Spark", url: "https://loyalspark.online" },
  realm: "api.loyalspark.online",
  intent: "charge" as Intent,
  payment: TEMPO_PAYMENT,
  endpoints: [
    // Read endpoints
    { route: "GET /me", desc: "Get agent profile, permissions, plan, and wallet info" },
    { route: "GET /workflow/program-status", desc: "Autonomous planner: lifecycle step + next_actions[]", amount: "1000" },
    { route: "GET /programs", desc: "List all active loyalty programs", amount: "1000" },
    { route: "GET /rewards", desc: "List rewards for a loyalty program", amount: "1000" },
    { route: "GET /balance", desc: "Check token balance and tier info (customer_address param)", amount: "1000" },
    { route: "GET /customers", desc: "List customers with token balances", amount: "2000" },
    { route: "GET /vouchers", desc: "List vouchers with filters", amount: "1000" },
    { route: "GET /analytics", desc: "Get program analytics and metrics", amount: "5000" },
    { route: "GET /offers", desc: "List active P2P marketplace offers", amount: "1000" },
    { route: "GET /merchant-profile", desc: "Read merchant profile", amount: "1000" },
    // Write endpoints
    { route: "POST /workflow/generate-program-defaults", desc: "Propose program defaults from business context", amount: "1000" },
    { route: "POST /programs", desc: "Deploy new B20 loyalty token (default; legacy ERC-20 via token_standard)", amount: "50000" },
    { route: "POST /register-program", desc: "Register deployed token as loyalty program", amount: "10000" },
    { route: "POST /update-program-config", desc: "Update cashback_rate / points_per_dollar", amount: "5000" },
    { route: "POST /activate-program", desc: "Get activation calldata (legacy ERC-20 only)", amount: "10000" },
    { route: "POST /program-status", desc: "Update program status after on-chain action", amount: "5000" },
    { route: "POST /rewards", desc: "Create a new reward for a program", amount: "10000" },
    { route: "POST /mint", desc: "Mint loyalty tokens (fee-first calls[] + confirm)", amount: "10000" },
    { route: "POST /mint/confirm", desc: "Settle protocol fee after mint/earn" },
    { route: "POST /earn", desc: "Cashback mint from purchase amount × rate", amount: "10000" },
    { route: "POST /transfer", desc: "Transfer loyalty tokens between wallets", amount: "5000" },
    { route: "POST /offers", desc: "Create P2P escrow offer for token trading", amount: "10000" },
    { route: "POST /accept-offer", desc: "Accept a P2P offer (atomic escrow swap)", amount: "10000" },
    { route: "POST /cancel-offer", desc: "Cancel your own P2P offer", amount: "5000" },
    { route: "POST /redeem-reward", desc: "Redeem reward → create voucher", amount: "10000" },
    { route: "POST /vouchers/use", desc: "Mark voucher as used", amount: "5000" },
    { route: "POST /merchant-profile", desc: "Create or update merchant profile", amount: "5000" },
  ],
},
```

> **Note on `amount` field**: Values are in base units with 6 decimals (USDC standard).
> - `"1000"` = $0.001
> - `"5000"` = $0.005
> - `"10000"` = $0.01
> - `"50000"` = $0.05
> - Free endpoints (like GET /me) have no `amount` field.

### 4. Verify Your Changes

```bash
pnpm check:types   # Types must pass
pnpm build          # Build must succeed
```

### 5. Register on MPPScan (Recommended)

Before submitting your PR, register on [MPPScan](https://www.mppscan.com/register) by Merit Systems. This makes your service discoverable by agents immediately, even before the PR is merged.

### 6. Test the Gateway

Verify the gateway works before submitting:

```bash
# Install mppx CLI
npm install -g mppx

# Create a Tempo wallet
mppx account create

# Test free endpoint
mppx https://api.loyalspark.online/mpp-gateway/me \
  -H "x-api-key: YOUR_KEY"

# Test paid endpoint (will trigger 402 → auto-pay → response)
mppx https://api.loyalspark.online/mpp-gateway/programs \
  -H "x-api-key: YOUR_KEY"
```

### 7. Create Pull Request

**Title:**
```
feat: add Loyal Spark — onchain loyalty protocol for AI agents
```

**Description:**
```markdown
Loyal Spark is a Web3 loyalty ecosystem on Base L2 that enables AI agents to
autonomously create B20 loyalty programs (legacy ERC-20 optional), mint tokens, manage rewards,
and trade on a P2P marketplace.

## Checklist

- [x] Service is **live and accepting payments** via MPP
- [x] Entry added to `schemas/services.ts`
- [x] Types pass: `pnpm check:types`
- [x] Build succeeds: `pnpm build`

## Service Details

- **Gateway URL**: https://api.loyalspark.online/mpp-gateway
- **Payment**: USDC on Tempo (TEMPO_PAYMENT)
- **Integration**: First-party (we run the gateway directly)
- **Category**: Blockchain
- **18 API endpoints** with per-request pricing ($0.001–$0.05)
- **Also supports**: x402 (Coinbase/Base USDC), MCP Server, REST API with subscriptions

## Links

- Website: https://loyalspark.online
- Docs: https://loyalspark.online/api-docs
- llms.txt: https://loyalspark.online/llms.txt
- Agent Manifest: https://loyalspark.online/.well-known/agent.json
- GitHub: https://github.com/aspekt19/unboxed-loyalty-spark
```

### 8. Wait for Review

The Tempo team reviews PRs for quality and novelty. They prioritize services that are:
- **High quality** — live, functional, well-documented
- **Novel** — not duplicating existing services in the catalog

## Pricing Summary

| Endpoint | Method | Price (USD) | Amount (base units) |
|---|---|---|---|
| /me | GET | Free | — |
| /programs | GET | $0.001 | 1000 |
| /rewards | GET | $0.001 | 1000 |
| /balance | GET | $0.001 | 1000 |
| /customers | GET | $0.002 | 2000 |
| /vouchers | GET | $0.001 | 1000 |
| /analytics | GET | $0.005 | 5000 |
| /offers | GET | $0.001 | 1000 |
| /programs | POST | $0.05 | 50000 |
| /register-program | POST | $0.01 | 10000 |
| /activate-program | POST | $0.01 | 10000 |
| /program-status | POST | $0.005 | 5000 |
| /rewards | POST | $0.01 | 10000 |
| /mint | POST | $0.01 | 10000 |
| /transfer | POST | $0.005 | 5000 |
| /offers | POST | $0.01 | 10000 |
| /accept-offer | POST | $0.01 | 10000 |
| /cancel-offer | POST | $0.005 | 5000 |
