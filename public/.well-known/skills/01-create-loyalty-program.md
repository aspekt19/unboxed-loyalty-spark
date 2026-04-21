# Skill: Create a Loyalty Program

## Goal
Deploy a new ERC-20 loyalty token on Base and register a loyalty program.

## Required Scope
`mint` or `create_program`

## When to Use
- You want to launch a new loyalty/rewards program for a business
- You need a custom ERC-20 token for customer engagement

## Steps

### Step 1: Get Deploy Calldata

```bash
curl -X POST \
  "https://api.loyalspark.online/agent-api/programs" \
  -H "x-api-key: lsk_..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Coffee Rewards",
    "symbol": "COFFEE",
    "expiration_days": 365
  }'
```

**Response:**
```json
{
  "message": "Execute the factory transaction to deploy your loyalty token...",
  "program_details": {
    "name": "Coffee Rewards",
    "symbol": "COFFEE",
    "expiration_days": 365
  },
  "contract_call": {
    "to": "0x5F3DdBa12580CFdc6016258774cCc19C4250dA80",
    "function": "createLoyaltyToken(string,string,address)",
    "calldata": "0x800e675c...",
    "chain": "Base (8453)",
    "builder_code": "bc_wdmnog7m"
  }
}
```

**MCP equivalent:** `create_loyalty_program`

### Step 2: Execute On-Chain Deploy
Send the calldata to the factory contract using your server wallet. Extract `token_address` from the `LoyaltyTokenCreated` event (topic[1]).

### Step 3: Register Program in Database

```bash
curl -X POST \
  "https://api.loyalspark.online/agent-api/register-program" \
  -H "x-api-key: lsk_..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Coffee Rewards",
    "symbol": "COFFEE",
    "token_address": "0xDeployedTokenAddress",
    "expiration_days": 365,
    "cashback_rate": 5,
    "points_per_dollar": 1
  }'
```

Optional: omit `cashback_rate` / `points_per_dollar` to use defaults (5% and 1 pt/$). To change them later, use **POST `/update-program-config`** (or MCP `update_program_config`).

**MCP equivalent:** `register_loyalty_program`

### Step 4: Activate Program (2 On-Chain Transactions)
Programs start as `inactive`. To mint tokens, you must activate:

```bash
curl -X POST \
  "https://api.loyalspark.online/agent-api/activate-program" \
  -H "x-api-key: lsk_..." \
  -H "Content-Type: application/json" \
  -d '{ "token_address": "0xDeployedTokenAddress" }'
```

This returns **2 transactions** to execute in order:
1. `unpauseUtility()` — enables transfers and burns
2. `enableMinting()` — allows new tokens to be created

**MCP equivalent:** `activate_loyalty_program`

### Step 5: Update Database Status

After both on-chain transactions confirm:

```bash
curl -X POST \
  "https://api.loyalspark.online/agent-api/program-status" \
  -H "x-api-key: lsk_..." \
  -H "Content-Type: application/json" \
  -d '{
    "token_address": "0xDeployedTokenAddress",
    "status": "active"
  }'
```

**MCP equivalent:** `update_program_status`

### Step 6: Verify Program
List your programs to confirm:

```bash
curl -H "x-api-key: lsk_..." \
  "https://api.loyalspark.online/agent-api/programs"
```

**MCP equivalent:** `list_loyalty_programs`

## Full Flow Summary

```
POST /programs          → get factory calldata
   ↓ execute on-chain
POST /register-program  → save to database (status: inactive)
POST /update-program-config → (optional) change cashback_rate / points_per_dollar
POST /activate-program  → get unpause + enableMinting calldata
   ↓ execute 2 on-chain txs
POST /program-status    → update DB to "active"
POST /mint              → now you can mint tokens!
```

## Success Criteria
- ✅ Program created with `status: "active"`
- ✅ `token_address` is a valid Base contract address
- ✅ Program appears in `GET /programs` list
- ✅ Both `unpauseUtility()` and `enableMinting()` executed on-chain

## Important Notes
- Each program deploys a real ERC-20 token on Base mainnet
- Programs have expiration dates — renew before expiry
- The `builder_code` ensures proper Base attribution
- **You must activate before minting** — inactive programs reject mint requests

## Next Skills
- [Mint Tokens](./02-mint-tokens.md) — start distributing tokens
- [Manage Rewards](./04-manage-rewards.md) — create redeemable rewards
