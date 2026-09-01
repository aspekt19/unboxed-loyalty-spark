# Skill: Transfer Loyalty Tokens

## Goal
Transfer loyalty tokens between wallets — for P2P transfers, rewards distribution, or inter-agent operations.

## Required Scope
`mint`

## When to Use
- Transfer tokens from one wallet to another
- Distribute tokens from a treasury wallet
- Agent-to-agent token transfer

## Steps

### Step 1: Verify Program Ownership
Ensure the token belongs to your program:

```bash
curl -H "x-api-key: lsk_..." \
  "https://api.loyalspark.online/agent-api/programs"
```

### Step 2: Transfer via REST API

```bash
curl -X POST \
  "https://api.loyalspark.online/agent-api/transfer" \
  -H "x-api-key: lsk_..." \
  -H "Content-Type: application/json" \
  -d '{
    "token_address": "0xYourTokenAddress",
    "to_address": "0xRecipientWallet",
    "amount": 50
  }'
```

### Step 3: Execute Onchain Transaction
The API returns calldata for `transfer(address,uint256)`:

**Response:**
```json
{
  "contract_call": {
    "to": "0xYourTokenAddress",
    "function": "transfer(address,uint256)",
    "args": ["0xRecipientWallet", 50],
    "calldata": "0xa9059cbb...",
    "chain": "Base (8453)",
    "builder_code": "bc_wdmnog7m"
  }
}
```

**MCP equivalent:** `transfer_loyalty_tokens`

### Recipient holders (`rwk_`) — same transfer, different auth

Merchants use `lsk_` + `transfer_loyalty_tokens`. **Token holders** (customer / autonomous agent bound to one wallet) use **`rwk_`**:

- **MCP:** `prepare_loyalty_token_transfer` on `recipient-loyalty-mcp` (B20-compatible `transfer(address,uint256)` + Builder Code; amount in human units, 18 decimals in encoding — same as merchant tool).
- **REST:** `POST …/recipient-api/prepare-transfer` with JSON `{ "token_address", "to", "amount" }` and header `x-api-key: rwk_…`.

The loyalty program must exist and be **`active`** in Loyal Spark. The signing EOA must be the wallet bound to the `rwk_` key; recipients can send to **any** address when the B20 transfer policy allows it. For Base smart accounts, use normal `approve` calldata for escrow: B20 ERC-2612 permit uses version `"1"` and does not accept ERC-1271 contract signatures.

## Important Notes
- Transfer requires the sender to hold sufficient token balance
- If a B20 transfer reverts, inspect `TRANSFER_SENDER` / `TRANSFER_RECEIVER` policy scopes and granular `TRANSFER` pause before assuming a balance problem
- The calldata includes Base Builder Code for attribution
- Program must be in `active` status

## Success Criteria
- ✅ Calldata generated with correct recipient and amount
- ✅ Transaction executed onchain successfully
- ✅ Recipient balance updated

## Next Skills
- [Mint Tokens](./02-mint-tokens.md)
- [Marketplace Trading](./06-marketplace-trading.md)
