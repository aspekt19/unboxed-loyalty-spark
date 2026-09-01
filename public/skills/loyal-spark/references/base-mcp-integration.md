# Pairing Loyal Spark with Base MCP

Loyal Spark and Base MCP are complementary:

- **Loyal Spark MCP** → loyalty business logic (programs, rewards, vouchers, P2P, analytics). Returns calldata or workflow metadata.
- **Base MCP** → wallet primitives (address, balance, signing, sending, EIP-5792 batches). Executes calldata.

If both servers are connected, keep this division of labor.

## Detection

Check whether Base MCP tools such as `send_calls`, `get_wallets`, and balance/history tools are exposed alongside Loyal Spark tools. If yes, use the paired flow. If only Loyal Spark is connected, use the Loyal Spark CDP MPC wallet path (`use_agent_wallet: true`) or ask for a signer.

## Paired flows

### 1. Deploy a new B20 loyalty program (default)

1. `create_loyalty_program(name, symbol, ...)` → returns one B20 factory call.
2. Base MCP `send_calls([{ to: factory, data, value: "0x0" }])`.
3. Wait for the receipt; extract `token_address` from `B20Created` `topics[1]`, or call `GET /agent-api/tx-receipt?tx_hash=…`.
4. `register_loyalty_program({ token_address, token_standard: "b20", ... })`.
5. The program is active. Do **not** send `activate_loyalty_program` for B20.

`initCalls` already grant `MINT_ROLE` atomically to the merchant and any requested `extra_minters`, such as the CDP agent wallet.

### 2. Deploy a legacy ERC-20 program

1. Create with `token_standard: "erc20"`.
2. Broadcast the legacy factory call and extract the emitted token address.
3. Register it; it starts inactive.
4. Call `activate_loyalty_program` and pass both returned calls to `send_calls`.
5. Sync `update_program_status({ status: "active" })` after both transactions confirm.

### 3. Mint loyalty points

1. `mint_loyalty_tokens({ token_address, recipient, amount })` → fee-first `calls[]` plus `fee_obligation_id`.
2. One EIP-5792 `send_calls` batch in the returned order: protocol fee, then recipient mint.
3. Call `confirm_mint_fee` with the confirmed fee tx hash (and recipient tx hash when returned).

### 4. Redeem a reward

1. Recipient `prepare_loyalty_token_transfer({ token_address, to: merchant, amount })`.
2. Base MCP signs and broadcasts the transfer.
3. Wait for confirmation.
4. Recipient `redeem_my_reward({ reward_id, tx_hash })` → server verifies and issues the voucher.

### 5. P2P swap

1. Create or inspect the offer.
2. Prepare the token `approve` and escrow call(s).
3. Use `send_calls` when the response returns a batch.
4. Accept/cancel only after checking the current offer status and confirmed transaction.

## Custom plugin shortcut (`agent-prepare`)

If Base MCP loads the Loyal Spark custom plugin, each supported loyalty action becomes a GET against `https://api.loyalspark.online/agent-prepare/<action>` returning:

```json
{ "chainId": 8453, "description": "...", "transactions": [{ "to": "0x…", "data": "0x…", "value": "0x0" }], "builder_code": "bc_wdmnog7m" }
```

Actions: `create-program`, `activate-program`, `mint`, `transfer` (`lsk_`) · `recipient-transfer`, `recipient-approve` (`rwk_`). Hand `transactions` to Base MCP `send_calls`; the Builder Code suffix is already appended.

## B20-specific checks

- B20 is Base-native and ERC-20-compatible at the operation interface; it is not a custom ERC-20 proxy.
- If a transfer reverts, inspect B20 policy scopes and granular pause state before assuming a balance issue.
- ERC-2612 permit uses EIP-712 version `"1"`; ERC-1271 smart-contract signatures are not accepted. Use a normal `approve` transaction for a smart account.
- B20's memo variants can provide onchain order/campaign attribution, but current Loyal Spark prepared calldata uses standard mint/transfer calls unless the endpoint explicitly says otherwise.

## Builder Code preservation

Every platform-generated calldata blob carries the 29-byte Builder Code suffix for `bc_wdmnog7m`. Do not modify or trim `data`. Base MCP forwards it as-is for ERC-8021 attribution.

## When not to use Base MCP

- Headless / cron agents: use Loyal Spark's CDP MPC wallet (`POST /agent-wallet`) and `use_agent_wallet: true` where supported.
- Subscriptions, x402, and MPP: use the dedicated payment flows, not raw loyalty calldata.
