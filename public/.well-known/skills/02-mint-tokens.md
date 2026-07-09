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

### Step 3: Execute Onchain Transactions (two required)
The API returns **two** pieces of calldata for `mint(address,uint256)` on the **same** token contract. **Both** transactions must be submitted for correct commission (the protocol fee is a separate mint to the platform wallet).

1. **`recipient_calldata`** — mint full `amount` to the customer.
2. **`fee_calldata`** — mint `fee_amount` (plan %) to `fee_wallet`.

Order: you may send recipient first, then fee (same as server-wallet CDP flow). Skipping the fee tx means commission was not collected onchain.

**Response (shape):**
```json
{
  "mint": { "id": "uuid", "amount": 100, "recipient_address": "0x...", "token_address": "0x..." },
  "fee_percent": 1,
  "fee_amount": 1,
  "fee_wallet": "0x5cc0Aa9ed773F413f81f78a62F2e94109CE26205",
  "recipient_calldata": "0x40c10f19...",
  "fee_calldata": "0x40c10f19...",
  "message": "… two transactions …",
  "contract": {
    "token_address": "0xYourTokenAddress",
    "function": "mint(address,uint256)",
    "recipient_params": ["0xCustomerWallet", 100],
    "fee_params": ["0x5cc0Aa9ed773F413f81f78a62F2e94109CE26205", 1],
    "chain": "Base (8453)",
    "builder_code": "bc_wdmnog7m"
  }
}
```

**MCP equivalent:** `mint_loyalty_tokens` (same two-calldata commission model).

### Step 4: Verify Balance
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
- ✅ Both calldata values returned with builder code suffix
- ✅ Customer balance updated after onchain execution of **recipient** mint (fee mint credits platform)

## Next Skills
- [Transfer Tokens](./03-transfer-tokens.md)
- [Check Balance & Tiers](./05-balance-and-tiers.md)
