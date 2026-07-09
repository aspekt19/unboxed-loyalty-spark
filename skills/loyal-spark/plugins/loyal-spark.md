---
title: "Loyal Spark Plugin"
description: "Base MCP custom plugin for onchain loyalty programs on Base L2 via Loyal Spark. Prepares calldata for send_calls (EIP-5792); Base Account signs and broadcasts."
---

# Loyal Spark Plugin (for Base MCP)

> [!IMPORTANT]
> Complete Base MCP onboarding (see Base's `SKILL.md`) before calling any Loyal Spark endpoint. Only ask for the user's wallet when a flow needs it.

Loyal Spark is an onchain loyalty protocol on Base L2 (chain **8453**): ERC-20 loyalty programs, mint / transfer of points, rewards & vouchers, P2P escrow marketplace, and `LOYAL-XXXXXX` gift certificates.

This plugin follows the standard Base MCP custom plugin contract:

1. **Prepare** — call a `GET https://api.loyalspark.online/agent-prepare/<action>` endpoint with an `x-api-key`. Response returns `{ chainId, description, transactions: [{ to, data, value }], builder_code }`.
2. **Sign** — hand the `transactions` array to Base MCP's **`send_calls`** tool (EIP-5792 atomic batch). Base Account approves and broadcasts.
3. **Sync (optional)** — for flows that record onchain results (e.g. `redeem_reward` needs `tx_hash`), call the matching Loyal Spark REST or MCP endpoint after settlement.

Every calldata blob ends with the ERC-8021 suffix encoding Builder Code **`bc_wdmnog7m`**. **Do not modify or trim `data`.** Base MCP forwards it as-is → Base ecosystem attribution.

---

## Auth

- **Merchant** actions (`create-program`, `activate-program`, `mint`, `transfer`): `x-api-key: lsk_…` — get one at [loyalspark.online/merchant](https://loyalspark.online/merchant) → AI Agents, or via SIWE at `POST /agent-register-siwe`.
- **Recipient / holder** actions (`recipient-transfer`, `recipient-approve`): `x-api-key: rwk_…` — get one at the same page or via SIWE at `POST /recipient-api/register`.
- **Fallback for surfaces that cannot forward headers**: append `?api_key=lsk_…` to the URL.

---

## Prepare endpoints

Base: `https://api.loyalspark.online/agent-prepare`

### Merchant

| Action | Method + path | Required params |
| --- | --- | --- |
| Deploy new program | `GET /create-program` | `name`, `symbol` (≤32 / ≤11 chars) |
| Activate program (unpause + grant MINTER_ROLE) | `GET /activate-program` | `token` |
| Mint points to a customer | `GET /mint` | `token`, `to`, `amount` (human units) |
| Merchant-side ERC-20 transfer | `GET /transfer` | `token`, `to`, `amount` |

### Recipient / holder

| Action | Method + path | Required params |
| --- | --- | --- |
| Send loyalty tokens to any address | `GET /recipient-transfer` | `token`, `to`, `amount` |
| Approve a spender (e.g. escrow) | `GET /recipient-approve` | `token`, `spender`, `amount` |

Introspection (no auth): `GET /agent-prepare` returns action list, chain id, and builder code.

---

## Response shape

```json
{
  "chainId": 8453,
  "description": "Mint 100 LOYAL to 0xabc… (+1 protocol fee)",
  "transactions": [
    { "to": "0xTOKEN", "data": "0x40c10f19…62635f77646d6e6f67376d…", "value": "0x0" },
    { "to": "0xTOKEN", "data": "0x40c10f19…62635f77646d6e6f67376d…", "value": "0x0" }
  ],
  "builder_code": "bc_wdmnog7m",
  "note": "Send as EIP-5792 batch (send_calls). Two mint calls: recipient + protocol fee."
}
```

Pass `transactions` directly to Base MCP `send_calls`. When more than one call is returned, they **must** be atomically batched — do not split them across separate approvals.

---

## Paired execution flows

### Deploy + activate a program

```
1. GET /agent-prepare/create-program?name=Coffee%20Points&symbol=CPT
   → send_calls([{to: factory, data, value: 0x0}])
2. Wait for receipt; extract token_address from the LoyaltyTokenCreated log
3. POST https://api.loyalspark.online/agent-api/register-program
     body: { token_address, cashback_rate, points_per_dollar }
     header: x-api-key: lsk_…
4. GET /agent-prepare/activate-program?token=0xTOKEN
   → send_calls(both transactions atomically)
```

### Mint points to a customer

```
1. GET /agent-prepare/mint?token=0xTOKEN&to=0xCUSTOMER&amount=100
   → send_calls(transactions)   ← two calls: recipient + fee
```

### Recipient claims a reward

```
1. rwk_ agent: GET /agent-prepare/recipient-transfer?token=0xTOKEN&to=0xMERCHANT&amount=50
   → send_calls([...])
2. rwk_ agent: POST https://api.loyalspark.online/recipient-api/redeem-reward
     body: { reward_id, tx_hash }        ← issues voucher server-side
```

### Merchant-side transfer

```
1. GET /agent-prepare/transfer?token=0xTOKEN&to=0xOTHER&amount=25
   → send_calls([...])
```

---

## When NOT to use this plugin

- **Read-only** actions (balances, rewards catalog, voucher lookup, analytics): call the Loyal Spark MCP server (`https://api.loyalspark.online/loyalty-mcp`) or REST (`/agent-api/*`) directly — no calldata / signing needed.
- **Fully autonomous agents without a Base Account** (cron jobs, backend workers): use a Loyal Spark **CDP MPC wallet** via `POST /agent-wallet` and pass `use_agent_wallet: true` on the relevant MCP tool. Loyal Spark signs server-side. See `references/base-mcp-integration.md`.
- **x402 pay-per-call MCP** (no API key, pay in USDC per request): see `references/x402-paid.md`.

---

## Discovery

- Plugin (this file): https://loyalspark.online/skills/loyal-spark/plugins/loyal-spark.md
- Full skill: https://loyalspark.online/skills/loyal-spark/SKILL.md
- Agent manifest: https://loyalspark.online/.well-known/agent.json
- OpenAPI: https://loyalspark.online/openapi.json
- Bazaar (x402) discovery: https://api.loyalspark.online/.well-known/x402 (mirror: https://loyalspark.online/.well-known/x402.json)

## Write-safety

Before any write, echo back token address, recipient / spender, amount, and program id or symbol. Wait for explicit user confirmation. Never strip Builder Code from `data`. Never claim a transaction is settled without a `tx_hash`.

## License

MIT.
