---
title: "Loyal Spark Plugin"
description: "Base MCP plugin reference for onchain loyalty programs on Base via Loyal Spark MCP. Pair Loyal Spark's calldata-prep tools with Base Account signing."
---

# Loyal Spark Plugin (for Base MCP)

> [!IMPORTANT]
> Complete the short Base MCP onboarding flow defined in Base's `SKILL.md` before calling any Loyal Spark command or tool. Fetch the user's wallet address only when a flow actually needs it.

Loyal Spark is an onchain loyalty protocol on Base L2: ERC-20 loyalty programs, mint/transfer of points, rewards & vouchers, P2P escrow marketplace, and `LOYAL-XXXXXX` gift certificates. The plugin exposes Loyal Spark as an external MCP server that pairs with Base MCP for wallet signing.

This plugin has one supported execution path: **Loyal Spark MCP for business logic + Base MCP for signing**.

---

## Environment Detection

1. **Loyal Spark MCP tools exposed** (e.g. `list_loyalty_programs`, `mint_loyalty_tokens`): use the paired flow below.
2. **Not exposed**: help the user install Loyal Spark MCP, then ask them to reconnect.

### Install Loyal Spark MCP

- **Claude.ai / Claude Desktop / iOS / Android:** Customize → Connectors → Add custom connector, name `loyal-spark`, URL `https://api.loyalspark.online/loyalty-mcp`, custom header `x-api-key: lsk_…`.
- **ChatGPT:** Settings → Connectors → Create, MCP URL `https://api.loyalspark.online/loyalty-mcp`, custom header `x-api-key`.
- **Claude Code / Codex / Cursor / Hermes:** see https://loyalspark.online/skills/loyal-spark/references/install.md.

The user gets an `lsk_…` key (merchant) or `rwk_…` key (recipient/holder) at https://loyalspark.online/merchant → AI Agents, or via SIWE on `agent-register-siwe`.

---

## Tool Routing (Loyal Spark MCP)

Tool descriptions exposed by the MCP server are the source of truth. The high-level groups:

| Group | Tools |
| --- | --- |
| Programs | `list_loyalty_programs`, `create_loyalty_program`, `register_loyalty_program`, `activate_loyalty_program`, `update_program_status`, `update_program_config` |
| Mint / Transfer | `mint_loyalty_tokens`, `earn_points`, `transfer_loyalty_tokens` |
| Rewards & Vouchers | `list_rewards`, `create_reward`, `update_reward_status`, `redeem_reward`, `use_voucher`, `check_voucher_status` |
| Marketplace (P2P) | `list_marketplace_offers`, `create_personalized_offer`, `cancel_stale_offers` |
| Analytics | `get_program_analytics`, `get_platform_stats` (admin), `export_customers` |
| Gift Certificates | `create_gift_certificate`, `list_gift_certificates`, `revoke_gift_certificate`, `mark_gift_certificate_minted` |
| Recipient (`rwk_`) | `list_my_loyalty_balances`, `prepare_loyalty_token_transfer`, `redeem_my_reward`, `claim_gift_certificate`, `list_my_gift_certificates`, P2P (`list_p2p_offers`, `create_p2p_offer`, `accept_p2p_offer`, `cancel_p2p_offer`) |

---

## Paired Execution Flow (Base MCP signs)

Loyal Spark **never broadcasts**. Every write tool returns `{ to, data, value }` calldata with Builder Code `bc_wdmnog7m` (ERC-8021) appended — preserve `data` byte-for-byte.

### Deploy + activate a program

```
1. loyal-spark/create_loyalty_program(name, symbol, ...) → { to: factory, data, value: 0 }
2. base-mcp/send_transaction(calldata)                    → user approves, broadcasts
3. loyal-spark/register_loyalty_program(token_address, cashback_rate, points_per_dollar)
4. loyal-spark/activate_loyalty_program(token_address)    → batched calls (unpause + grant MINTER_ROLE)
5. base-mcp/batch_calls(calls)                            → single approval (EIP-5792)
```

### Mint points

```
1. loyal-spark/mint_loyalty_tokens({ token_address, recipient, amount }) → calldata with fee
2. base-mcp/send_transaction(calldata)
```

### Recipient redeems a reward

```
1. recipient: loyal-spark/prepare_loyalty_token_transfer({ token_address, to: merchant, amount })
2. base-mcp/send_transaction(calldata)
3. recipient: loyal-spark/redeem_my_reward({ reward_id, tx_hash }) → voucher issued server-side
```

### P2P swap

```
1. loyal-spark/create_p2p_offer(...) → [approve, createOffer]
2. base-mcp/batch_calls(calls)        → atomic lock in escrow
```

---

## Paid Routes (x402 / MPP)

Loyal Spark also exposes both REST and MCP via x402 (USDC on Base) and MPP (pathUSD on Tempo). Manifests:

- https://loyalspark.online/.well-known/x402.json (Bazaar-discoverable)
- https://loyalspark.online/.well-known/mpp.json

Use the API-key path when the user has a plan; use x402/MPP when paying per request from a Base Account or Tempo wallet.

---

## Write-Safety

Before any write, echo back token address, recipient, amount, and program id. Wait for explicit confirmation. Never strip Builder Code from `data`. Never claim a transaction is settled without a tx hash.

## License

Loyal Spark plugin is MIT.
