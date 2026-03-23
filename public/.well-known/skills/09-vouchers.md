# Skill: Voucher Management

## Goal
Track and manage vouchers — proof of reward redemption that customers receive when they claim rewards.

## Required Scopes
`read`, `manage_rewards`

## When to Use
- Verify if a customer has redeemed a reward
- Check voucher status (active, used, expired)
- Manage voucher lifecycle for merchant operations

## How Vouchers Work
1. Customer selects a reward and burns required tokens
2. System generates a unique voucher code
3. Customer presents voucher to merchant for fulfillment
4. Merchant marks voucher as used

## Voucher Lifecycle

```
[Customer burns tokens] → [Voucher created: status=active]
                              ↓
                    [Customer presents voucher]
                              ↓
                    [Merchant verifies & marks used]
                              ↓
                    [Voucher status=used, used_at set]
```

## Steps

### Step 1: View Issued Vouchers
Query vouchers for your program:

```bash
curl -H "x-api-key: lsk_..." \
  "https://bzxmejzssxjazswgwqqs.supabase.co/functions/v1/agent-api/rewards?token_address=0x..."
```

### Step 2: Verify a Voucher
Check voucher validity by code:

```bash
curl -X POST \
  "https://bzxmejzssxjazswgwqqs.supabase.co/functions/v1/verify-voucher" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "VOUCHER_CODE_HERE",
    "merchant_address": "0xMerchantAddress"
  }'
```

### Step 3: Track Redemption Metrics
From analytics, monitor:
- **total_vouchers_issued**: How many rewards were claimed
- **vouchers_redeemed**: How many were actually used
- **avg_voucher_cost**: Average token cost per redemption

## Voucher Data Structure
```json
{
  "id": "uuid",
  "code": "ABC123XYZ",
  "reward_name": "Free Coffee",
  "cost": 50,
  "token_symbol": "COFFEE",
  "customer_address": "0x...",
  "status": "active",
  "activated_at": "2026-03-23T...",
  "used_at": null
}
```

## Best Practices
- Vouchers with `status: "active"` are valid for redemption
- Always verify voucher belongs to the correct merchant
- Track `used_at` timestamps for operational analytics
- High voucher issuance but low redemption = rewards may be impractical

## Success Criteria
- ✅ Vouchers queried by program/merchant
- ✅ Individual voucher verified by code
- ✅ Redemption rate tracked via analytics

## Next Skills
- [Manage Rewards](./04-manage-rewards.md) — adjust reward catalog
- [Analytics & CRM](./07-analytics-crm.md) — deep dive into metrics
