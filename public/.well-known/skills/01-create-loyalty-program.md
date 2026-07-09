# Skill: Create a Loyalty Program

## Goal
Deploy a new **B20** loyalty token on Base (default) and register an **active** program. Legacy **ERC-20** factory remains available via `token_standard: "erc20"`.

## Required Scope
`mint` or `create_program`

## When to Use
- Launch a new loyalty/rewards program for a business
- Autonomous agents: B20 grants `MINT_ROLE` to merchant + CDP wallet in one deploy tx

## B20 flow (default — 2 steps)

### Step 1: Get B20 deploy calldata

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

Optional: `"token_standard": "b20"` (default), `"agent_wallet_address": "0x..."`, `"extra_minters": ["0x..."]`.

**Response (B20):**
```json
{
  "message": "Execute the B20 factory transaction (single tx)...",
  "program_details": { "token_standard": "b20", "name": "Coffee Rewards", "symbol": "COFFEE" },
  "contract_call": {
    "to": "0xB20f000000000000000000000000000000000000",
    "function": "createB20(uint8,bytes32,bytes,bytes[])",
    "calldata": "0x...",
    "builder_code": "bc_wdmnog7m",
    "mint_role_grantees": ["0xMerchant...", "0xCdpWallet..."]
  }
}
```

**MCP equivalent:** `create_loyalty_program`

### Step 2: Execute deploy + register

1. Broadcast `contract_call.calldata` to `contract_call.to` (one transaction).
2. Extract `token_address` from **B20Created** event on the factory (`topic[1]`) or `GET /tx-receipt?tx_hash=0x...`.
3. Register:

```bash
curl -X POST \
  "https://api.loyalspark.online/agent-api/register-program" \
  -H "x-api-key: lsk_..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Coffee Rewards",
    "symbol": "COFFEE",
    "token_address": "0xB200...",
    "token_standard": "b20",
    "expiration_days": 365,
    "cashback_rate": 5,
    "points_per_dollar": 1
  }'
```

Program is saved as **`status: active`** — mint immediately. **No** `activate-program` step.

### Step 3: Mint

```bash
curl -X POST \
  "https://api.loyalspark.online/agent-api/mint" \
  -H "x-api-key: lsk_..." \
  -H "Content-Type: application/json" \
  -d '{ "token_address": "0xB200...", "to": "0xCustomer...", "amount": 100 }'
```

## Legacy ERC-20 flow (`token_standard: "erc20"`)

Add `"token_standard": "erc20"` to POST `/programs`. Factory: `0x5F3DdBa12580CFdc6016258774cCc19C4250dA80`, event **LoyaltyTokenCreated**.

Then: `register-program` → `activate-program` (unpauseUtility + enableMinting, 2 txs) → `program-status` → `active`.

**MCP:** `activate_loyalty_program` returns no-op for B20; legacy calldata for `erc20`.

## Full flow summary (B20)

```
POST /programs           → B20 factory calldata (1 tx)
   ↓ execute on-chain
POST /register-program   → DB status: active, token_standard: b20
POST /mint               → distribute tokens
```

## Success criteria
- Program `status: "active"`, `token_standard: "b20"`
- Token address starts with `0xB200…` (B20) or legacy proxy (erc20)
- Appears in `GET /programs`
- x402 / MCP mint and transfer work without activation

## Notes
- B20 is ERC-20 compatible — balances, transfer, escrow, vouchers unchanged
- Builder Code `bc_wdmnog7m` appended to deploy calldata
- Existing ERC-20 programs keep working; only **new** deploys default to B20

## Next skills
- [Mint Tokens](./02-mint-tokens.md)
- [Manage Rewards](./04-manage-rewards.md)
