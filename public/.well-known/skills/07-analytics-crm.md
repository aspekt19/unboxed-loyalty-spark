# Skill: Analytics & CRM

## Goal
Access program analytics, customer data, and performance metrics to make data-driven decisions.

## Required Scope
`read`

## When to Use
- Monitor program health and engagement metrics
- Segment customers by activity and token holdings
- Generate reports on token distribution and redemption

## Steps

### Step 1: Get Program Analytics

```bash
curl -H "x-api-key: lsk_..." \
  "https://bzxmejzssxjazswgwqqs.supabase.co/functions/v1/agent-api/analytics"
```

**MCP equivalent:** `get_program_analytics`

**Response:**
```json
{
  "analytics": [
    {
      "program_name": "Coffee Rewards",
      "token_address": "0x...",
      "token_symbol": "COFFEE",
      "total_customers": 150,
      "active_customers_7d": 45,
      "active_customers_30d": 89,
      "total_vouchers_issued": 320,
      "vouchers_redeemed": 210,
      "total_tokens_spent": 15000,
      "avg_voucher_cost": 47
    }
  ]
}
```

### Step 2: List Customers

```bash
curl -H "x-api-key: lsk_..." \
  "https://bzxmejzssxjazswgwqqs.supabase.co/functions/v1/agent-api/customers?token_address=0x..."
```

### Step 3: Analyze Key Metrics

**Engagement Rate:** `active_customers_30d / total_customers × 100`  
**Redemption Rate:** `vouchers_redeemed / total_vouchers_issued × 100`  
**Avg Token Spend:** `total_tokens_spent / vouchers_redeemed`

### Step 4: Act on Insights

| Metric | Low | Action |
|--------|-----|--------|
| Engagement < 30% | Low activity | Mint bonus tokens to inactive users |
| Redemption < 50% | Rewards too expensive | Lower reward costs or create cheaper options |
| Active 7d declining | Losing momentum | Launch a campaign or referral program |

## Decision Logic
```
IF active_customers_30d < total_customers * 0.3 THEN
  → Trigger re-engagement: mint bonus tokens to dormant wallets
  
IF vouchers_redeemed / total_vouchers_issued < 0.5 THEN
  → Create lower-cost rewards to encourage redemption

IF active_customers_7d > active_customers_30d * 0.7 THEN
  → Program is healthy — consider expansion
```

## Success Criteria
- ✅ Analytics data retrieved for all programs
- ✅ Key metrics calculated and actionable
- ✅ Agent can recommend improvements based on data

## Next Skills
- [Mint Tokens](./02-mint-tokens.md) — act on engagement insights
- [Manage Rewards](./04-manage-rewards.md) — optimize reward catalog
