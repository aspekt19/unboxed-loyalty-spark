# Calldata + Builder Code Flow

Loyal Spark write tools **prepare** transactions — they return `{ to, data, value, builder_code }` ready for any signer. They never broadcast.

## Why

- Same path works for Base Account (via Base MCP), Privy embedded wallets, Coinbase CDP MPC agent wallets, or a user's own EOA.
- Builder Code `bc_wdmnog7m` (ERC-8021) is appended as the last 29 bytes of `data` so onchain analytics attribute the transaction to Loyal Spark. **Do not strip it.**

## Standard flow

```
1. AI agent → Loyal Spark MCP (e.g. mint_loyalty_tokens)
        → returns { to, data, value, ... }
2. AI agent → Signer (Base MCP / CDP / user wallet)
        → wallet signs and broadcasts
3. AI agent → Loyal Spark MCP (optional: sync helpers, e.g. mark voucher used)
```

## Tools that return calldata

| Tool | Returns |
| --- | --- |
| `create_loyalty_program` | Factory `deploy` calldata |
| `register_loyalty_program` | DB-only, no calldata |
| `activate_loyalty_program` | `unpause` + `grantRole(MINTER_ROLE,…)` (batched via EIP-5792) |
| `mint_loyalty_tokens` | ERC-20 `mintWithFee` calldata |
| `earn_points` | Auto-calculated mint calldata from purchase amount × cashback |
| `transfer_loyalty_tokens` | ERC-20 `transfer` calldata |
| `prepare_loyalty_token_transfer` (recipient) | Same as above, but holder-signed |
| `create_p2p_offer` / `accept_p2p_offer` / `cancel_p2p_offer` | Escrow contract calldata |
| `redeem_reward` | Expects an existing on-chain transfer tx hash, then issues voucher server-side |

## Pairing with Base MCP

When Base MCP is connected, pass the returned `{ to, data, value }` into Base MCP's batched-call tool (it supports EIP-5792 atomic batches). For multi-step flows like activation (unpause + grant role), batch both calls in a single Base Account approval.

## Pairing with Loyal Spark CDP wallet (autonomous)

If the agent has its own CDP MPC wallet (`POST /agent-wallet`), pass `use_agent_wallet: true` on the relevant tool — Loyal Spark signs and broadcasts server-side. This is the only path that requires no human approval. The CDP wallet must already hold MINTER_ROLE on the program.

## Gas, fees, value

- All loyalty contracts live on Base mainnet (chain 8453).
- Mint has a protocol fee per agent plan: Free 1.25%, Pro 0.5%, Enterprise 0.25%. The fee is included in the returned calldata.
- P2P swaps charge a 0.5% protocol fee on completed swaps.
- `value` is `0` for all loyalty operations; only USDC payments (subscriptions, x402) require value transfer, which is handled by the dedicated payment routes, not the loyalty calldata.
