---
name: loyal-spark
description: Onchain loyalty protocol on Base. AI agents create B20 loyalty programs by default (legacy ERC-20 optional), mint/transfer points, manage rewards and vouchers, redeem LOYAL-XXXXXX gift certificates, and trade on P2P escrow via MCP or REST. Returns ready-to-sign calldata for Base Account, CDP MPC, or any user wallet.
version: 0.1.0
homepage: https://loyalspark.online
license: MIT
---

# Loyal Spark Skill

> [!IMPORTANT]
> Run the short onboarding below at the start of every conversation that touches Loyal Spark, including conversations that jump straight to a single tool. Onboarding is two sentences plus one disclaimer.

## Detection

The Loyal Spark MCP exposes its tools to the harness when connected. If no `get_platform_info`, `list_loyalty_programs`, or `create_loyalty_program` tool is callable, the MCP server is not installed — direct the user to [references/install.md](references/install.md) and stop.

If Loyal Spark tools are available, load [references/tone.md](references/tone.md) (its rules apply for the entire conversation) and then continue to Onboarding.

If — and only if — sibling files are not readable (e.g. the skill body was pasted with no local filesystem), fetch the same relative path from `https://raw.githubusercontent.com/aspekt19/unboxed-loyalty-spark/a2a-agents/skills/loyal-spark/` using `web_request` (Base MCP) or your own HTTP tool. The same fallback applies to every `references/...` and `plugins/...` link in this file.

## Onboarding

Do this once per session, before any real work:

1. **Briefly mention what is available** — one sentence. The user can create loyalty programs (**B20 by default** on Base, or legacy ERC-20 via API), mint and transfer loyalty points on Base, manage rewards and vouchers, issue and redeem `LOYAL-XXXXXX` gift certificates, and trade tokens on a P2P escrow marketplace. Tool discovery comes from the MCP — do not enumerate.

2. **Show this disclaimer verbatim** before any write:

   > By using Loyal Spark you agree to the Loyal Spark Terms (https://loyalspark.online/terms) and Privacy Policy. Loyal Spark prepares onchain calldata; the connected wallet (Base Account, CDP MPC, or a user wallet) is what actually signs and broadcasts transactions on Base mainnet (chain 8453).

3. **Identity is optional up front.** Only call `get_my_profile` / `get_recipient_profile` when the user asks who they are, or when a flow needs the bound wallet address.

## Tools

Loyal Spark advertises its own tool catalog (39 merchant + 20 recipient tools). Read the tool descriptions exposed by the MCP — they are the source of truth. Do not preload the catalog from this skill.

Key patterns that deserve their own reference:

| Topic | Reference |
| --- | --- |
| Two API personas: `lsk_` (merchant) vs `rwk_` (recipient/holder) | [references/auth.md](references/auth.md) |
| Calldata execution flow (mint / transfer / activate / P2P) | [references/calldata-flow.md](references/calldata-flow.md) |
| Paid x402 MCP — JSON-RPC over `x402-gateway/mcp-tools/<name>` | [references/x402-paid.md](references/x402-paid.md) |
| Pairing with Base MCP for signing | [references/base-mcp-integration.md](references/base-mcp-integration.md) |
| Gift certificates (`LOYAL-XXXXXX`, batch up to 100) | [references/gift-certificates.md](references/gift-certificates.md) |
| Install steps per surface | [references/install.md](references/install.md) |
| Tone, attribution and write-safety rules | [references/tone.md](references/tone.md) |

### Loading referenced files

* **Default — local.** Read each `references/…` link from the same directory as this `SKILL.md`.
* **Fallback — web.** If local read fails, fetch the same relative path from `https://raw.githubusercontent.com/aspekt19/unboxed-loyalty-spark/a2a-agents/skills/loyal-spark/<relative>`.
* **Lazy.** Only load a reference when the conversation actually needs it.

## Pairing with Base MCP (recommended)

Loyal Spark tools return **ready-to-sign calldata**, not signed transactions. If Base MCP is also connected, the typical flow is:

1. Call a Loyal Spark tool (e.g. `mint_loyalty_tokens`, `transfer_loyalty_tokens`, `activate_loyalty_program`) → receive `{ to, data, value }` calldata.
2. Hand the calldata to Base MCP's batched-call / send-transaction tool (EIP-5792 supported).
3. Base Account shows the approval and signs onchain.

For autonomous agents without Base Account, use a Loyal Spark CDP MPC wallet (`agent-wallet` endpoint) — Loyal Spark signs server-side. See [references/calldata-flow.md](references/calldata-flow.md).

## Installation

```bash
# Vercel skills.sh CLI (any supported harness)
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
| x402 paid resources (canonical) | https://api.loyalspark.online/.well-known/x402 |
| x402 static mirror | https://loyalspark.online/.well-known/x402.json |
| MPP manifest | https://loyalspark.online/.well-known/mpp.json |
| Long LLM reference | https://loyalspark.online/llms-full.txt |

## License

MIT. See repository LICENSE.
