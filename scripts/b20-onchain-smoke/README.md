# B20 onchain smoke test (CDP agent → Base mainnet)

End-to-end proof that a Loyal Spark autonomous agent can deploy a **B20 loyalty
program** and **mint tokens** using its own **CDP MPC wallet** — with no
merchant signature — and that `MINT_ROLE` is granted **atomically** in the
deploy transaction (Option B).

## What it verifies onchain

| Step | Onchain evidence |
|------|------------------|
| Deploy | `B20Created(address,uint8,string,string,uint8,bytes)` emitted by `0xB20f…0000` |
| Atomic grant | `RoleGranted(MINT_ROLE, agent_cdp_wallet, …)` emitted by the new token |
| Merchant grant | `RoleGranted(MINT_ROLE, merchant_admin, …)` emitted by the new token |
| Mint | ERC-20 `Transfer(0x0, recipient, amount)` emitted by the new token |

`MINT_ROLE = keccak256("MINT_ROLE") = 0x154c00819833dac601ee5ddded6fda79d9d8b506b911b3dbd54cdb95fe6c3686`.

## Prereqs

- Merchant agent API key: `lsk_...` with scopes `read`, `mint`, `create_program`.
- Server-side CDP env keys (`CDP_API_KEY_ID`, `CDP_API_KEY_SECRET`, `CDP_WALLET_SECRET`) configured on the Loyal Spark deployment — the script aborts if the agent-wallet endpoint returns a `mock` wallet.
- The agent's CDP wallet must hold enough Base ETH for gas:
  - Deploy `createB20` ≈ **0.00015 ETH** (~250k gas)
  - Mint ≈ **0.00002 ETH**
  Fund the wallet address printed in Step 1 before Step 3.

## Run

```bash
cd scripts/b20-onchain-smoke
npm install
LOYAL_SPARK_API_KEY=lsk_... node run.mjs
```

### Options

| Env | Default | Purpose |
|-----|---------|---------|
| `API_BASE` | `https://api.loyalspark.online` | Loyal Spark API host |
| `BASE_RPC` | `https://mainnet.base.org` | Base mainnet RPC |
| `PROGRAM_NAME` | `B20 Smoke <ts>` | Token name |
| `PROGRAM_SYMBOL` | `SMK` | 2–5 char symbol |
| `MINT_RECIPIENT` | agent CDP wallet | Address to receive minted tokens |
| `MINT_AMOUNT` | `1` | Whole tokens (scaled server-side) |
| `SKIP_MINT=1` | – | Deploy-only run |

## Testnet notes

Base **Sepolia** works with the same code path: the B20 factory is the same
singleton precompile on every Base network. Point `BASE_RPC` at a Sepolia RPC
and run against a Loyal Spark deployment where the agent-wallet CDP `network`
field is `base-sepolia`. The main repo currently hard-codes `network: "base"`
in `supabase/functions/agent-wallet/index.ts`, so testnet requires a small
patch there — production mainnet is the primary target for this smoke test.

## Exit codes

- `0` — deploy + mint + all onchain events verified
- `1` — any step failed (see console for the exact assertion)
