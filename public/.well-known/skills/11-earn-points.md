# Skill: Earn Points (Cashback from Purchases)

## Goal
Automatically calculate and mint loyalty tokens based on a customer's purchase amount, using the program's cashback rate.

## Required Scope
`mint`

## When to Use
- A customer made a purchase and should receive loyalty tokens proportional to the amount spent
- You want to automate point-of-sale token distribution
- A cashier scans a customer's QR and enters the purchase amount

## How It Works
Instead of manually calculating how many tokens to mint, the `/earn` endpoint does it for you:

```
tokens = purchase_amount × cashback_rate / 100
```

Each program has a default `cashback_rate` (e.g. 5%). You can override it per request.

## Steps

### Step 1: Get Program Info
List your programs to find the `token_address` and current `cashback_rate`:

```bash
curl -H "x-api-key: lsk_..." \
  "https://api.loyalspark.online/agent-api/programs"
```

### Step 2: Earn Points via REST API

```bash
curl -X POST \
  "https://api.loyalspark.online/agent-api/earn" \
  -H "x-api-key: lsk_..." \
  -H "Content-Type: application/json" \
  -d '{
    "token_address": "0xYourTokenAddress",
    "customer_address": "0xCustomerWallet",
    "purchase_amount": 50
  }'
```

Optional: override cashback rate for this request:
```json
{
  "token_address": "0x...",
  "customer_address": "0x...",
  "purchase_amount": 50,
  "cashback_rate": 10
}
```

### Step 3: Execute On-chain Transactions (fee-first)
Same as minting — the response returns a fee-first `calls[]` bundle:

1. **`calls[0]` (`protocol_fee`)** — mint platform fee to `fee_wallet`. **Send first.**
2. **`calls[1]` (`recipient_mint`)** — mint calculated tokens to the customer.

Submit in order, or atomically via EIP-5792 `wallet_sendCalls`. Then confirm the fee with
`POST /agent-api/mint/confirm { obligation_id, fee_tx_hash }` (MCP: `confirm_mint_fee`).
Unconfirmed obligations (5+ older than 60 minutes) block further mints with HTTP 402.

**Response (shape):**
```json
{
  "earn": {
    "purchase_amount": 50,
    "cashback_rate": 5,
    "tokens_earned": 2.5
  },
  "mint": { "id": "uuid", "amount": 2.5, "recipient_address": "0x...", "token_address": "0x..." },
  "fee_percent": 1.25,
  "fee_amount": 0.03125,
  "fee_wallet": "0x5cc0Aa9ed773F413f81f78a62F2e94109CE26205",
  "fee_obligation_id": "uuid",
  "calls": [
    { "to": "0xToken", "data": "0x40c10f19...", "value": "0x0", "purpose": "protocol_fee" },
    { "to": "0xToken", "data": "0x40c10f19...", "value": "0x0", "purpose": "recipient_mint" }
  ],
  "message": "Customer earns 2.5 COFFEE tokens for a $50 purchase (5% cashback)...",
  "contract": {
    "token_address": "0x...",
    "function": "mint(address,uint256)",
    "chain": "Base (8453)",
    "builder_code": "bc_wdmnog7m"
  }
}
```

**MCP equivalent:** `earn_points` + `confirm_mint_fee` (same fee-first model).

### Step 4: Verify Balance

```bash
curl -H "x-api-key: lsk_..." \
  "https://api.loyalspark.online/agent-api/balance?token_address=0x...&customer_address=0x..."
```

## Cashback Rate Examples

| Purchase Amount | Cashback Rate | Tokens Earned |
|----------------|---------------|---------------|
| $10 | 5% | 0.5 |
| $50 | 5% | 2.5 |
| $100 | 10% | 10 |
| $250 | 3% | 7.5 |

## Transaction Fees
Same as regular minting — paid **in the loyalty tokens being minted**, not in USDC or fiat:

| Plan | Commission (% of tokens minted) |
|------|--------------------------------|
| Free | 1.25% |
| Pro | 0.5% |
| Enterprise | 0.25% |

## Success Criteria
- ✅ Tokens auto-calculated from purchase amount × cashback rate
- ✅ Mint record created in database
- ✅ Fee-first `calls[]` returned with builder code suffix
- ✅ Fee obligation confirmed via `/agent-api/mint/confirm`
- ✅ Customer balance updated after on-chain execution

## Next Skills
- [Mint Tokens (manual)](./02-mint-tokens.md)
- [Check Balance & Tiers](./05-balance-and-tiers.md)
- [Manage Rewards](./04-manage-rewards.md)
