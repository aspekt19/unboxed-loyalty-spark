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
  "https://bzxmejzssxjazswgwqqs.supabase.co/functions/v1/agent-api/programs"
```

### Step 2: Mint Tokens via REST API

```bash
curl -X POST \
  "https://bzxmejzssxjazswgwqqs.supabase.co/functions/v1/agent-api/mint" \
  -H "x-api-key: lsk_..." \
  -H "Content-Type: application/json" \
  -d '{
    "token_address": "0xYourTokenAddress",
    "recipient_address": "0xCustomerWallet",
    "amount": 100
  }'
```

### Step 3: Execute Onchain Transaction
The API returns calldata for the `mint(address,uint256)` function. Execute it using your server wallet.

**Response:**
```json
{
  "mint": {
    "id": "uuid",
    "amount": 100,
    "recipient_address": "0x...",
    "token_address": "0x..."
  },
  "contract_call": {
    "to": "0xYourTokenAddress",
    "function": "mint(address,uint256)",
    "calldata": "0x40c10f19...",
    "chain": "Base (8453)",
    "builder_code": "bc_wdmnog7m"
  }
}
```

**MCP equivalent:** `mint_loyalty_tokens`

### Step 4: Verify Balance
Check the customer's updated balance:

```bash
curl -H "x-api-key: lsk_..." \
  "https://bzxmejzssxjazswgwqqs.supabase.co/functions/v1/agent-api/balance?token_address=0x...&customer_address=0x..."
```

## Transaction Fees
| Plan | Fee |
|------|-----|
| Free | 1% of minted amount |
| Pro | 0.5% |
| Enterprise | 0.25% |

## Success Criteria
- ✅ Mint record created in database
- ✅ Calldata returned with builder code suffix
- ✅ Customer balance updated after onchain execution

## Next Skills
- [Transfer Tokens](./03-transfer-tokens.md)
- [Check Balance & Tiers](./05-balance-and-tiers.md)
