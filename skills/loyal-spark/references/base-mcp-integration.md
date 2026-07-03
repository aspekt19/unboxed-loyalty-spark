# Pairing Loyal Spark with Base MCP

Loyal Spark and Base MCP are complementary, not competing:

- **Loyal Spark MCP** → loyalty business logic (programs, rewards, vouchers, P2P, analytics). Returns calldata.
- **Base MCP** → wallet primitives (sign, send, swap, batch via EIP-5792). Executes calldata.

If both servers are connected, prefer this division of labor.

## Detection

Check whether Base MCP tools (e.g. `send_transaction`, `batch_calls`, `get_address`, `get_balance`) are exposed alongside Loyal Spark tools. If yes, use the paired flow below. If only Loyal Spark is connected, fall back to the Loyal Spark CDP wallet path (`use_agent_wallet: true`) or ask the user to install Base MCP for human-in-the-loop signing.

## Paired flow

### 1. Deploy a new loyalty program

1. `create_loyalty_program(name, symbol, ...)` → returns factory deploy calldata.
2. Base MCP `send_transaction({ to: factory, data, value: 0 })` → user approves in Base Account.
3. Wait for receipt; extract `token_address` from the deploy log (or `GET /agent-api/tx-receipt?tx_hash=…` — free).
4. `register_loyalty_program(token_address, cashback_rate, points_per_dollar)`.
5. `activate_loyalty_program(token_address)` → returns **batched** calls (unpause + grant MINTER_ROLE).
6. Base MCP `batch_calls(calls)` → single Base Account approval (EIP-5792).

### 2. Mint loyalty points to a customer

1. `mint_loyalty_tokens({ token_address, recipient, amount })` → calldata with fee + Builder Code.
2. Base MCP `send_transaction(calldata)`.

### 3. Customer redeems a reward (recipient-side)

1. Recipient agent (`rwk_`) calls `prepare_loyalty_token_transfer({ token_address, to: merchant, amount })` → ERC-20 transfer calldata.
2. Base MCP signs and broadcasts.
3. Recipient agent calls `redeem_my_reward({ reward_id, tx_hash })` → server verifies tx and issues a voucher.

### 4. P2P swap

1. `create_p2p_offer({ offer_token, offer_amount, request_token, request_amount })` → two calls: approve + createOffer.
2. Base MCP `batch_calls` to lock tokens in escrow atomically.

## Custom-plugin shortcut (`agent-prepare`)

If Base MCP loads the Loyal Spark custom plugin ([`plugins/loyal-spark.md`](../plugins/loyal-spark.md)), each loyalty action becomes a single GET against `https://api.loyalspark.online/agent-prepare/<action>` that returns a `send_calls`-ready payload:

```json
{ "chainId": 8453, "description": "...", "transactions": [{ "to": "0x…", "data": "0x…", "value": "0x0" }], "builder_code": "bc_wdmnog7m" }
```

Actions: `create-program`, `activate-program`, `mint`, `transfer` (`x-api-key: lsk_…`) · `recipient-transfer`, `recipient-approve` (`x-api-key: rwk_…`). Hand the `transactions` array straight to Base MCP `send_calls` — Builder Code is already appended.


## Builder Code preservation

Every calldata blob Loyal Spark returns ends with 29 bytes (`62635f…`) encoding `bc_wdmnog7m`. **Do not modify or trim the data field.** Base MCP forwards it as-is, which is exactly what we need for ERC-8021 attribution on Base.

## When NOT to use Base MCP

- Headless / cron agents: use the Loyal Spark CDP MPC wallet (`POST /agent-wallet`) and pass `use_agent_wallet: true` on the relevant tool. No human approval required, no Base Account needed.
- Subscriptions / x402 USDC payments: use the dedicated payment routes, not raw Base MCP sends.
