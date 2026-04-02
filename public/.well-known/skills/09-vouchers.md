# Skill: Voucher Management

## Goal
Full lifecycle management of vouchers — from redeeming rewards (burning tokens) to marking vouchers as used.

## Required Scopes
- `read` — to redeem rewards and create vouchers
- `manage_rewards` — to mark vouchers as used

## When to Use
- Customer agent wants to redeem a reward (exchange tokens for a voucher)
- Merchant agent wants to verify and mark a voucher as used
- Query voucher status and history

## How Vouchers Work (Agent Flow)
1. Customer's agent transfers tokens to the merchant's wallet (on-chain ERC-20 transfer)
2. Agent calls `POST /redeem-reward` with the transaction hash → system verifies the transfer on-chain and creates a voucher
3. Customer presents voucher code to merchant
4. Merchant's agent calls `POST /vouchers/use` to mark it as used

## Voucher Lifecycle

```
[Agent transfers tokens on-chain] → [POST /redeem-reward with tx_hash]
                                        ↓
                              [Voucher created: status=active]
                                        ↓
                              [Customer presents voucher code]
                                        ↓
                              [Merchant: POST /vouchers/use]
                                        ↓
                              [Voucher status=used, used_at set]
```

## Steps

### Step 1: List Available Rewards
```bash
curl -H "x-api-key: lsk_..." \
  "https://bzxmejzssxjazswgwqqs.supabase.co/functions/v1/agent-api/rewards?token_address=0x..."
```

### Step 2: Transfer Tokens (On-Chain)
The customer agent must execute an ERC-20 `transfer(merchant_address, cost)` on-chain.
Use the `/transfer` endpoint to get the calldata:

```bash
curl -X POST \
  "https://bzxmejzssxjazswgwqqs.supabase.co/functions/v1/agent-api/transfer" \
  -H "x-api-key: lsk_..." \
  -H "Content-Type: application/json" \
  -d '{
    "token_address": "0xTokenAddress",
    "to_address": "0xMerchantAddress",
    "amount": 50
  }'
```

### Step 3: Redeem Reward (Create Voucher)
After the transfer is confirmed on-chain, create a voucher:

```bash
curl -X POST \
  "https://bzxmejzssxjazswgwqqs.supabase.co/functions/v1/agent-api/redeem-reward" \
  -H "x-api-key: lsk_..." \
  -H "Content-Type: application/json" \
  -d '{
    "reward_id": "uuid-of-reward",
    "customer_address": "0xCustomerAddress",
    "transaction_hash": "0xTransferTxHash"
  }'
```

Response:
```json
{
  "voucher": {
    "id": "uuid",
    "code": "LOYAL-AB12-CD34-EF56-GH78",
    "reward_name": "Free Coffee",
    "cost": 50,
    "status": "active",
    "activated_at": "2026-04-02T...",
    "transaction_hash": "0x..."
  }
}
```

### Step 4: Use Voucher (Merchant)
When the customer presents the voucher, the merchant agent marks it as used:

```bash
curl -X POST \
  "https://bzxmejzssxjazswgwqqs.supabase.co/functions/v1/agent-api/vouchers/use" \
  -H "x-api-key: lsk_..." \
  -H "Content-Type: application/json" \
  -d '{
    "voucher_code": "LOYAL-AB12-CD34-EF56-GH78"
  }'
```

Or by voucher ID:
```json
{ "voucher_id": "uuid-of-voucher" }
```

### Step 5: Check Voucher Status (Public — No API Key)
Anyone (customer, agent, or third party) can check a voucher's status:

```bash
curl "https://bzxmejzssxjazswgwqqs.supabase.co/functions/v1/agent-api/vouchers/status?code=LOYAL-AB12-CD34-EF56-GH78"
```

Response:
```json
{
  "voucher": {
    "id": "uuid",
    "code": "LOYAL-AB12-CD34-EF56-GH78",
    "reward_name": "Free Coffee",
    "status": "active",
    "cost": 50,
    "token_symbol": "COFFEE",
    "merchant_address": "0x...",
    "activated_at": "2026-04-02T...",
    "used_at": null
  }
}
```

### Step 6: View Vouchers (Merchant)
Query vouchers for your program:

```bash
curl -H "x-api-key: lsk_..." \
  "https://bzxmejzssxjazswgwqqs.supabase.co/functions/v1/agent-api/vouchers?token_address=0x...&status=active"
```

### Step 6: Track Redemption Metrics
From analytics, monitor:
- **total_vouchers_issued**: How many rewards were claimed
- **vouchers_redeemed**: How many were actually used
- **avg_voucher_cost**: Average token cost per redemption

## MCP Server Tools
The same functionality is available via MCP:
- `redeem_reward` — Create a voucher from a verified token transfer
- `use_voucher` — Mark a voucher as used
- `check_voucher_status` — Check voucher status (public, no key needed)
- `list_vouchers` — Query vouchers by status

## Best Practices
- Always wait for on-chain confirmation before calling `/redeem-reward`
- If the transaction isn't confirmed yet, the API returns `retryable: true` — retry after 3 seconds
- Vouchers with `status: "active"` are valid for redemption
- High voucher issuance but low redemption = rewards may be impractical

## Success Criteria
- ✅ Reward redeemed via token transfer + voucher creation
- ✅ Voucher marked as used by merchant
- ✅ Redemption rate tracked via analytics

## Next Skills
- [Manage Rewards](./04-manage-rewards.md) — adjust reward catalog
- [Analytics & CRM](./07-analytics-crm.md) — deep dive into metrics
