# Skill: Marketplace Trading

## Goal
Create and manage P2P token trading offers on the onchain marketplace with atomic escrow swaps.

## Required Scope
`trade`

## When to Use
- Exchange loyalty tokens between different programs
- Create liquidity for your program's tokens
- Accept or cancel existing marketplace offers

## How It Works
The marketplace uses a smart contract escrow on Base for atomic swaps:
1. Creator approves escrow contract → locks offer tokens
2. Accepter approves escrow contract → calls `fillOffer()` 
3. Atomic swap executes — both transfers happen in one transaction, or neither does

**Escrow Contract:** `0xA569C95AfC1BCF381c48BcF336ED9D2c014bcdDF`  
**Protocol Fee:** 0.5% on completed swaps

## Steps

### Step 1: List Active Offers

```bash
curl -H "x-api-key: lsk_..." \
  "https://api.loyalspark.online/agent-api/offers?status=active&limit=50"
```

**MCP equivalent:** `list_marketplace_offers`

### Step 2: Create an Offer

```bash
curl -X POST \
  "https://api.loyalspark.online/agent-api/offers" \
  -H "x-api-key: lsk_..." \
  -H "Content-Type: application/json" \
  -d '{
    "offer_token_address": "0xYourToken",
    "offer_amount": 100,
    "request_token_address": "0xDesiredToken",
    "request_amount": 50
  }'
```

### Step 3: Accept an Offer (two-phase)

**Phase 1 — reserve** (no `transaction_hash`): the offer becomes `accepted` (reserved for your wallet) and the response returns `approve` + `fillOffer` escrow calldata.

```bash
curl -X POST \
  "https://api.loyalspark.online/agent-api/accept-offer" \
  -H "x-api-key: lsk_..." \
  -H "Content-Type: application/json" \
  -d '{"offer_id": "uuid-of-the-offer", "onchain_offer_id": 42}'
```

**Phase 2 — finalize**: after the escrow `fillOffer` transaction confirms, call again with `transaction_hash`. The API verifies the tx on Base and sets the offer to `completed`.

```bash
curl -X POST \
  "https://api.loyalspark.online/agent-api/accept-offer" \
  -H "x-api-key: lsk_..." \
  -H "Content-Type: application/json" \
  -d '{"offer_id": "uuid-of-the-offer", "transaction_hash": "0x..."}'
```


### Step 4: Cancel Your Offer

```bash
curl -X POST \
  "https://api.loyalspark.online/agent-api/cancel-offer" \
  -H "x-api-key: lsk_..." \
  -H "Content-Type: application/json" \
  -d '{"offer_id": "uuid-of-your-offer"}'
```

## Trading Strategy Tips
- Monitor exchange rates between popular token pairs
- Set competitive rates to attract counter-parties
- Cancel stale offers to free locked tokens
- Use `limit` parameter to paginate large result sets

## Success Criteria
- ✅ Offers listed with correct status filtering
- ✅ New offer created with escrow calldata returned
- ✅ Offer accepted/cancelled with correct onchain calldata

## Next Skills
- [Transfer Tokens](./03-transfer-tokens.md) — direct transfers without marketplace
- [Analytics & CRM](./07-analytics-crm.md) — track trading activity
