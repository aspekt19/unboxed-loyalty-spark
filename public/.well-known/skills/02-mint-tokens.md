# Skill: Mint Loyalty Tokens

## Goal
Mint loyalty tokens to a customer wallet as a reward for purchases, engagement, or referrals.

## Required Scope
`mint`

## When to Use
- A customer made a purchase and should receive loyalty tokens
- You want to reward a user for completing an action
- An automation rule triggers a token distribution

## Steps

### Step 1: Get Program Token Address
List your programs to find the `token_address`:

```bash
curl -H "x-api-key: lsk_..." \
  "https://api.loyalspark.online/agent-api/programs"
```

Only mint into a program you own and that is already usable:

- B20: registered and active
- legacy ERC-20: activated and `program-status` updated to `active`

### Step 2: Mint Tokens via REST API

```bash
curl -X POST \
  "https://api.loyalspark.online/agent-api/mint" \
  -H "x-api-key: lsk_..." \
  -H "Content-Type: application/json" \
  -d '{
    "token_address": "0xYourTokenAddress",
    "recipient_address": "0xCustomerWallet",
    "amount": 100
  }'
```

### Step 3: Execute Onchain Transactions (fee-first)
The API returns a **fee-first `calls[]` bundle** for `mint(address,uint256)` on the **same** token contract:

1. **`calls[0]` — `purpose: "protocol_fee"`** — mint `fee_amount` (plan %) to `fee_wallet`. **Send this FIRST.**
2. **`calls[1]` — `purpose: "recipient_mint"`** — mint full `amount` to the customer.

Submit them in order, or atomically in one batch via **EIP-5792 `wallet_sendCalls`** if your wallet supports it.
Legacy fields `fee_calldata` / `recipient_calldata` are still returned for backwards compatibility, but `calls[]` is the source of truth for ordering.

This is **accountability**, not an on-chain atomic `mintWithFee`: the token contract does not enforce the fee. Instead every prepared mint writes a pending obligation (`fee_obligation_id`) that you must clear.

### Step 4: Confirm the protocol fee
```bash
curl -X POST "https://api.loyalspark.online/agent-api/mint/confirm" \
  -H "x-api-key: lsk_..." -H "Content-Type: application/json" \
  -d '{"obligation_id":"<fee_obligation_id>","fee_tx_hash":"0x...","recipient_tx_hash":"0x..."}'
```
The server verifies the fee mint on Base (Transfer from the zero address to the platform wallet) and settles the obligation.
**5 or more unpaid obligations older than 60 minutes block further mints with HTTP 402.**

**Response (shape):**
```json
{
  "mint": { "id": "uuid", "amount": 100, "recipient_address": "0x...", "token_address": "0x..." },
  "fee_percent": 1,
  "fee_amount": 1,
  "fee_wallet": "0x5cc0Aa9ed773F413f81f78a62F2e94109CE26205",
  "fee_obligation_id": "uuid",
  "calls": [
    { "to": "0xToken", "data": "0x40c10f19...", "value": "0x0", "purpose": "protocol_fee" },
    { "to": "0xToken", "data": "0x40c10f19...", "value": "0x0", "purpose": "recipient_mint" }
  ],
  "contract": { "function": "mint(address,uint256)", "chain": "Base (8453)", "builder_code": "bc_wdmnog7m" }
}
```

**MCP equivalent:** `mint_loyalty_tokens` + `confirm_mint_fee` (same fee-first model).

### Step 5: Verify Balance

Check the customer's updated balance:

```bash
curl -H "x-api-key: lsk_..." \
  "https://api.loyalspark.online/agent-api/balance?token_address=0x...&customer_address=0x..."
```

## Transaction Fees
| Plan | Mint commission (% of amount, as separate mint to platform) |
|------|----------------------------------------------------------------|
| Free | 1.25% |
| Pro | 0.5% |
| Enterprise | 0.25% |

## Success Criteria
- ✅ Mint record created in database
- ✅ Fee-first `calls[]` returned with builder code suffix
- ✅ Customer balance updated after onchain execution
- ✅ Fee obligation settled via `/agent-api/mint/confirm` (or MCP `confirm_mint_fee`)

## Next Skills
- [Transfer Tokens](./03-transfer-tokens.md)
- [Check Balance & Tiers](./05-balance-and-tiers.md)
