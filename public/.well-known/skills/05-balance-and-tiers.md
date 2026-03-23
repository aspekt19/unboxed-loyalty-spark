# Skill: Check Balance & Tiers

## Goal
Query a customer's token balance and tier status to personalize interactions.

## Required Scope
`read`

## When to Use
- Check if a customer has enough tokens to redeem a reward
- Determine a customer's loyalty tier for personalized offers
- Monitor token distribution across your customer base

## Steps

### Step 1: Check Individual Balance

```bash
curl -H "x-api-key: lsk_..." \
  "https://bzxmejzssxjazswgwqqs.supabase.co/functions/v1/agent-api/balance?token_address=0x...&customer_address=0x..."
```

**MCP equivalent:** `get_token_balance`

**Response:**
```json
{
  "balance": {
    "current": 150,
    "total_earned": 500,
    "tier": {
      "tier_name": "Gold",
      "tier_level": 2,
      "badge_color": "#FFD700",
      "cashback_multiplier": 1.5
    }
  }
}
```

### Step 2: List All Customers

```bash
curl -H "x-api-key: lsk_..." \
  "https://bzxmejzssxjazswgwqqs.supabase.co/functions/v1/agent-api/customers?token_address=0x..."
```

### Step 3: Use Tier Data for Decisions
Based on tier information, adjust your agent's behavior:
- **Bronze** (level 1): Standard rewards, basic offers
- **Silver** (level 2): Bonus tokens on purchases, priority support
- **Gold** (level 3): Exclusive rewards, higher cashback multiplier
- **Platinum** (level 4): VIP access, maximum cashback

## Decision Logic Example
```
IF customer.balance >= reward.cost THEN
  → Suggest redeeming the reward
ELSE
  → Calculate tokens needed: reward.cost - customer.balance
  → Suggest actions to earn more tokens

IF customer.tier.cashback_multiplier > 1.0 THEN
  → Apply bonus: mint_amount * cashback_multiplier
```

## Success Criteria
- ✅ Balance retrieved with current and total_earned values
- ✅ Tier information includes level and multiplier
- ✅ Agent can make decisions based on tier data

## Next Skills
- [Mint Tokens](./02-mint-tokens.md) — reward customers
- [Manage Rewards](./04-manage-rewards.md) — set up redeemable items
