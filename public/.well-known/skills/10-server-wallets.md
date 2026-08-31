# Skill: Server Wallets (CDP MPC)

## Goal
Create and manage autonomous server wallets for AI agents to sign onchain transactions without exposing private keys.

## Required Scope
None (available to all authenticated agents)

## When to Use
- Your agent needs to execute onchain transactions autonomously
- You want MPC-secured key management by Coinbase
- You need a dedicated wallet for each agent

## How It Works
Loyal Spark integrates Coinbase CDP (Coinbase Developer Platform) MPC wallets:
- **MPC (Multi-Party Computation)**: Private key is split across multiple parties — no single point of failure
- **Server-side signing**: Transactions are signed without exposing keys
- **Base native**: Wallets operate on Base L2 (Chain ID: 8453)

## Steps

### Step 1: Create a Server Wallet

```bash
curl -X POST \
  "https://api.loyalspark.online/agent-wallet" \
  -H "x-api-key: lsk_..." \
  -H "Content-Type: application/json" \
  -d '{"action": "create_wallet"}'
```

**Response:**
```json
{
  "wallet": {
    "id": "uuid",
    "wallet_address": "0xNewWalletAddress",
    "chain_id": 8453,
    "wallet_type": "cdp_mpc",
    "is_active": true
  }
}
```

### Step 2: Fund the Wallet
Send ETH (for gas) to the wallet address on Base. The wallet needs a small ETH balance to pay transaction fees.

### Step 3: Use Wallet for Operations
Once funded, the agent can:
- Execute mint calldata returned by `/mint` endpoint
- Execute transfer calldata from `/transfer` endpoint
- Accept marketplace offers via `/accept-offer`
- All transactions signed server-side via MPC

**Protocol fee on mints.** When you execute the `/mint` or `/earn` calldata yourself, you must send **both** calls in order — the `protocol_fee` mint first, then `recipient_mint` — and settle the obligation with `POST /agent-api/mint/confirm` (see [02-mint-tokens.md](./02-mint-tokens.md)). The fee is charged in your own loyalty tokens, not USDC. If you instead use `POST /agent-wallet` with `action: "server_mint"`, Loyal Spark sends the fee transaction itself and aborts the recipient mint if the fee fails, so no confirmation step is needed.

### Step 4: Check Wallet Status
Your wallet info is included in the `GET /me` response:

```bash
curl -H "x-api-key: lsk_..." \
  "https://api.loyalspark.online/agent-api/me"
```

## Security Model
| Feature | Detail |
|---------|--------|
| Key Storage | Split across MPC parties by Coinbase |
| Key Exposure | Never — keys are never assembled in one place |
| Transaction Signing | Server-side, no client involvement |
| Chain | Base L2 (8453) |
| Provider | Coinbase CDP |

## Best Practices
- Create one wallet per agent for clear accounting
- Keep minimal ETH balance for gas — replenish as needed
- Monitor wallet activity through agent activity logs
- Wallet address is permanent — use it as the agent's onchain identity

## Success Criteria
- ✅ Wallet created with valid Base address
- ✅ Wallet funded with ETH for gas
- ✅ Agent can execute calldata through the wallet
- ✅ Wallet appears in `GET /me` response

## Next Skills
- [Getting Started](./00-getting-started.md) — full setup guide
- [Mint Tokens](./02-mint-tokens.md) — first operation with your wallet
