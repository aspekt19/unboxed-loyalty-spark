# Skill: Manage Rewards

## Goal
Create and manage redeemable rewards that customers can claim by burning loyalty tokens.

## Required Scope
`manage_rewards`

## When to Use
- You want to offer discounts, products, or experiences in exchange for tokens
- Setting up a reward catalog for a loyalty program
- Managing active/inactive rewards

## Steps

### Step 1: List Existing Rewards

```bash
curl -H "x-api-key: lsk_..." \
  "https://bzxmejzssxjazswgwqqs.supabase.co/functions/v1/agent-api/rewards?token_address=0xYourToken"
```

**MCP equivalent:** `list_rewards` with `token_address` parameter

### Step 2: Create a New Reward

```bash
curl -X POST \
  "https://bzxmejzssxjazswgwqqs.supabase.co/functions/v1/agent-api/rewards" \
  -H "x-api-key: lsk_..." \
  -H "Content-Type: application/json" \
  -d '{
    "token_address": "0xYourTokenAddress",
    "name": "Free Coffee",
    "description": "Redeem for one free coffee at any location",
    "cost": 50
  }'
```

**MCP equivalent:** `create_reward`

### Step 3: Verify Reward Created

**Response:**
```json
{
  "reward": {
    "id": "uuid",
    "name": "Free Coffee",
    "description": "Redeem for one free coffee at any location",
    "cost": 50,
    "is_active": true,
    "created_at": "2026-03-23T..."
  }
}
```

## Reward Design Tips
- Set `cost` proportional to reward value (e.g., 50 tokens = $5 value)
- Use clear, descriptive names customers will understand
- Create tiered rewards: small (10 tokens), medium (50), premium (200)
- Deactivate rewards instead of deleting to preserve history

## Success Criteria
- ✅ Reward created with `is_active: true`
- ✅ Cost is reasonable relative to token earning rate
- ✅ Reward appears in `GET /rewards` list

## Next Skills
- [Voucher Management](./09-vouchers.md) — track redeemed rewards
- [Check Balance & Tiers](./05-balance-and-tiers.md) — verify customers can afford rewards
