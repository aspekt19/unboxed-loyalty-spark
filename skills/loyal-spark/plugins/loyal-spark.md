---
title: "Loyal Spark Plugin"
description: "Base MCP custom plugin for Base-native B20 loyalty programs. Prepares calldata for send_calls (EIP-5792); Base Account signs and broadcasts."
---

# Loyal Spark Plugin (for Base MCP)

> [!IMPORTANT]
> Complete Base MCP onboarding before calling a Loyal Spark endpoint. Only ask for the wallet when the selected flow needs it.

Loyal Spark is a loyalty protocol on Base Mainnet (chain **8453**). New programs use Base's native **B20 Asset** variant by default; legacy Loyal Spark ERC-20 programs remain available through an explicit API option. Rewards, vouchers, minting, transfers, and P2P escrow consume the same ERC-20-compatible token interface.

This plugin follows the Base MCP custom plugin contract:

1. **Prepare** — call `GET https://api.loyalspark.online/agent-prepare/<action>` with `x-api-key`. The response is `{ chainId, description, transactions: [{ to, data, value }], builder_code }`.
2. **Sign** — hand `transactions` to Base MCP's `send_calls` tool (EIP-5792 batch). Base Account approves and broadcasts.
3. **Sync** — for flows that record onchain results, wait for confirmation and call the matching Loyal Spark REST/MCP endpoint with the tx hash.

Every calldata blob carries the ERC-8021 suffix encoding Builder Code **`bc_wdmnog7m`**. **Do not modify or trim `data`.**

## Surface routing

`api.loyalspark.online` is **not** on the Base MCP `web_request` allowlist. On chat-only surfaces (Claude.ai, ChatGPT):

- Use harness HTTP / curl when available, or
- Ask the user to paste the JSON from a prepare URL, then continue with `send_calls`.

On Claude Code, Cursor, or Codex with shell access, fetch prepare endpoints directly with `x-api-key` in the header.

## Auth

- **Merchant** actions (`create-program`, `activate-program`, `mint`, `transfer`): `x-api-key: lsk_…`.
- **Recipient / holder** actions (`recipient-transfer`, `recipient-approve`): `x-api-key: rwk_…`.
- Query-string `api_key` authentication is not supported. Send `x-api-key` or `Authorization: Bearer` on every request.

## Prepare endpoints

Base: `https://api.loyalspark.online/agent-prepare`

| Action | Method + path | Required params |
| --- | --- | --- |
| Deploy new program (B20 default) | `GET /create-program` | `name`, `symbol` (≤32 / ≤11 chars) |
| Activate legacy ERC-20 program | `GET /activate-program` | `token` (no-op for B20) |
| Mint points to a customer | `GET /mint` | `token`, `to`, `amount` (human units) |
| Merchant-side transfer | `GET /transfer` | `token`, `to`, `amount` |
| Holder transfer | `GET /recipient-transfer` | `token`, `to`, `amount` |
| Holder approve for escrow | `GET /recipient-approve` | `token`, `spender`, `amount` |

Introspection: `GET /agent-prepare` returns action list, chain id, and Builder Code.

## B20 deploy flow

```text
1. GET /agent-prepare/create-program?name=Coffee%20Points&symbol=CPT
   → send_calls([{ to: B20 factory, data, value: 0x0 }])
2. Wait for receipt; extract token_address from B20Created topics[1]
3. POST https://api.loyalspark.online/agent-api/register-program
   body: { name, symbol, token_address, token_standard: "b20", ... }
4. Continue with rewards and minting; no activation transaction exists for B20.
```

The B20 factory's atomic `initCalls` grant `MINT_ROLE` to the merchant and configured extra minters. The token is active after database registration. Do not call `unpauseUtility` or `enableMinting` for B20.

## Legacy ERC-20 flow

```text
1. GET /create-program?...&standard=erc20 → send_calls(factory deployment)
2. Wait for LoyaltyTokenCreated and register with token_standard: "erc20"
3. GET /activate-program?token=0xTOKEN
   → send_calls(all returned activation transactions atomically)
4. POST /agent-api/program-status with status: "active"
```

## Mint and transfer

```text
# Merchant mint: fee-first calls[]
GET /agent-prepare/mint?token=0xTOKEN&to=0xCUSTOMER&amount=100
→ send_calls(transactions)  # protocol fee first, recipient mint second

# Holder transfer
GET /agent-prepare/recipient-transfer?token=0xTOKEN&to=0xDESTINATION&amount=25
→ send_calls(transactions)
```

After a prepared merchant mint, settle `fee_obligation_id` through `POST /agent-api/mint/confirm` unless a server-wallet action explicitly performs the fee itself.

## Onchain semantics relevant to agents

- B20 is a native precompile/singleton factory, not a deployed proxy contract.
- B20 Asset roles include admin, mint, burn, pause/unpause, metadata, and operator roles. Policies can gate transfer and mint scopes; granular pause can target transfer, mint, burn, or seize.
- ERC-2612 permit uses EIP-712 version `"1"`; ERC-1271 signatures are not accepted by B20, so smart accounts should use normal `approve`.
- Memo variants exist for onchain campaign/order attribution, but the current plugin prepare endpoints return standard calls unless their response says otherwise.

## When not to use this plugin

- Read-only actions: use Loyal Spark MCP or REST directly.
- Fully autonomous agents without a Base Account: use Loyal Spark CDP MPC wallets.
- x402 / MPP pay-per-call and subscriptions: use the dedicated payment flows; do not send payment assets through loyalty calldata.

## Discovery

- Plugin: https://loyalspark.online/skills/loyal-spark/plugins/loyal-spark.md
- Full skill: https://loyalspark.online/skills/loyal-spark/SKILL.md
- Agent manifest: https://loyalspark.online/.well-known/agent.json
- OpenAPI: https://loyalspark.online/openapi.json
- x402 discovery: https://api.loyalspark.online/.well-known/x402

## Write-safety

Before any write, echo back token address, recipient / spender, amount, and program id or symbol. Wait for explicit user confirmation. Never strip Builder Code from `data`. Never claim a transaction is settled without a confirmed `tx_hash`.

## License

MIT.
