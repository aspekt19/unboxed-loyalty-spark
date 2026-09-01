---
name: loyal-spark
description: Onchain loyalty protocol on Base. AI agents create native B20 Asset programs by default (legacy ERC-20 optional), mint/transfer points, manage rewards and vouchers, redeem LOYAL-XXXXXX gift certificates, and trade on P2P escrow via MCP or REST. Returns ready-to-sign calldata for Base Account, CDP MPC, or any user wallet.
version: 0.2.0
homepage: https://loyalspark.online
license: MIT
---

# Loyal Spark Skill

> [!IMPORTANT]
> Run the short onboarding below at the start of every conversation that touches Loyal Spark, including conversations that jump straight to a single tool. Onboarding is two sentences plus one disclaimer.

## Detection

The Loyal Spark MCP exposes its tools to the harness when connected. If no `get_platform_info`, `list_loyalty_programs`, or `create_loyalty_program` tool is callable, the MCP server is not installed — direct the user to [references/install.md](references/install.md) and stop.

If Loyal Spark tools are available, load [references/tone.md](references/tone.md) and continue to Onboarding. If sibling files are not readable, fetch the same relative path from the repository's public branch. Load references lazily only when the conversation needs them.

## Onboarding

1. **Briefly mention what is available** — one sentence. The user can create native B20 loyalty programs on Base (or legacy ERC-20 through the API), mint and transfer points, manage rewards and vouchers, issue and redeem `LOYAL-XXXXXX` gift certificates, and trade tokens on a P2P escrow marketplace.

2. **Show this disclaimer verbatim before any write:**

   > By using Loyal Spark you agree to the Loyal Spark Terms (https://loyalspark.online/legal/terms) and Privacy Policy (https://loyalspark.online/legal/privacy). Loyal Spark prepares onchain calldata; the connected wallet (Base Account, CDP MPC, or a user wallet) is what actually signs and broadcasts transactions on Base mainnet (chain 8453).

3. **Identity is optional up front.** Only call profile tools when the user asks who they are or when a flow needs the bound wallet address.

## Tools

Loyal Spark advertises its own tool catalog (39 merchant + 20 recipient tools). Read tool descriptions exposed by the MCP — they are the source of truth; do not preload a copied catalog from this skill.

| Topic | Reference |
| --- | --- |
| Two API personas: `lsk_` vs `rwk_` | [references/auth.md](references/auth.md) |
| B20 native spec and roles/policies | [references/b20-native-spec.md](references/b20-native-spec.md) |
| Payment choices: x402 exact, MPP, subscriptions | [references/payment-scenarios.md](references/payment-scenarios.md) · [references/x402-paid.md](references/x402-paid.md) |
| Calldata execution and fee obligations | [references/calldata-flow.md](references/calldata-flow.md) |
| Pairing with Base MCP for signing | [references/base-mcp-integration.md](references/base-mcp-integration.md) |
| Gift certificates | [references/gift-certificates.md](references/gift-certificates.md) |
| Install steps | [references/install.md](references/install.md) |
| Tone, attribution and write-safety | [references/tone.md](references/tone.md) |

## Pairing with Base MCP

Loyal Spark tools return **ready-to-sign calldata**, not signed transactions. With Base MCP: call the tool, pass `{ to, data, value }` to **`send_calls`** (EIP-5792 batch when multiple calls), let Base Account approve, wait for a receipt, then run any required sync endpoint. For autonomous agents without Base Account, use a Loyal Spark CDP MPC wallet (`agent-wallet` endpoint).

## Installation

```bash
npx skills add aspekt19/unboxed-loyalty-spark --skill loyal-spark
```

For per-surface install (Claude.ai, ChatGPT, Cursor, Claude Code, Codex, Hermes) see [references/install.md](references/install.md).

## Discovery endpoints

| Resource | URL |
| --- | --- |
| Agent manifest | https://loyalspark.online/.well-known/agent.json |
| OpenAPI 3.1 | https://loyalspark.online/openapi.json |
| MCP (merchant, 39 tools, `lsk_`) | https://api.loyalspark.online/loyalty-mcp |
| MCP (recipient, 20 tools, `rwk_`) | https://api.loyalspark.online/recipient-loyalty-mcp |
| x402 paid resources | https://api.loyalspark.online/.well-known/x402 |
| x402 static mirror | https://loyalspark.online/.well-known/x402.json |
| MPP manifest | https://loyalspark.online/.well-known/mpp.json |
| Long LLM reference | https://loyalspark.online/llms-full.txt |
| B20 native spec skill | https://loyalspark.online/.well-known/skills/14-b20-native-spec.md |
| Payment scenarios skill | https://loyalspark.online/.well-known/skills/15-payment-scenarios.md |

## License

MIT. See repository LICENSE.
