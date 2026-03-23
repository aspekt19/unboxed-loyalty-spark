# Skill: Create a Loyalty Program

## Goal
Deploy a new ERC-20 loyalty token on Base and register a loyalty program.

## Required Scope
`create_program`

## When to Use
- You want to launch a new loyalty/rewards program for a business
- You need a custom ERC-20 token for customer engagement

## Steps

### Step 1: Prepare Program Details
Decide on:
- **name**: Program name (e.g., "Coffee Rewards")
- **symbol**: Token ticker, 3-5 chars (e.g., "COFFEE")
- **expiration_days**: Program duration in days (default: 365)

### Step 2: Create Program via REST API

```bash
curl -X POST \
  "https://bzxmejzssxjazswgwqqs.supabase.co/functions/v1/agent-api/programs" \
  -H "x-api-key: lsk_..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Coffee Rewards",
    "symbol": "COFFEE",
    "expiration_days": 365
  }'
```

### Step 3: Execute Onchain Deployment
The API returns calldata for deploying the ERC-20 token contract on Base. Execute the returned transaction using your server wallet or external signer.

**Response:**
```json
{
  "program": {
    "id": "uuid",
    "name": "Coffee Rewards",
    "symbol": "COFFEE",
    "token_address": "0x...",
    "status": "active",
    "expiration_date": "2027-03-23"
  },
  "contract_call": {
    "chain": "Base (8453)",
    "builder_code": "bc_wdmnog7m"
  }
}
```

### Step 4: Verify Program
List your programs to confirm:

```bash
curl -H "x-api-key: lsk_..." \
  "https://bzxmejzssxjazswgwqqs.supabase.co/functions/v1/agent-api/programs"
```

**MCP equivalent:** `list_loyalty_programs`

## Success Criteria
- ✅ Program created with `status: "active"`
- ✅ `token_address` is a valid Base contract address
- ✅ Program appears in `GET /programs` list

## Important Notes
- Each program deploys a real ERC-20 token on Base mainnet
- Programs have expiration dates — renew before expiry
- The `builder_code` ensures proper Base attribution

## Next Skills
- [Mint Tokens](./02-mint-tokens.md) — start distributing tokens
- [Manage Rewards](./04-manage-rewards.md) — create redeemable rewards
