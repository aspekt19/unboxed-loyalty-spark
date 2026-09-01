---
name: Base docs get-started (2026 refresh)
description: New Base docs structure (B20 native precompiles, Vibenet, x402 payment lifecycle, agent resources) studied 2026-09-01
type: reference
---

Studied https://docs.base.org/get-started/base + all sub-pages on 2026-09-01. Key facts for Loyal Spark:

## Network
- Base Mainnet: RPC `https://mainnet.base.org`, chainId 8453, explorer basescan.org. Sepolia: 84532.
- **Vibenet** — new demo/test network used in docs demos (chain.base.org/demos).
- Flashblocks: 200ms preconfirmations; <1s confirmations, sub-cent fees.

## B20 (Base-native token standard — we already default to it)
- B20 = ERC-20 superset implemented as **Rust precompiles** (chain-native, no custom contract/audit). Spec: /specifications/b20/specification-overview ("Beryl" spec).
- All tokens created via singleton **factory precompile**: `createB20(B20Variant variant, bytes32 salt, bytes params, bytes[] initCalls)`.
- Roles: DEFAULT_ADMIN, MINT, BURN, SEIZE, PAUSE/UNPAUSE, METADATA, OPERATOR (Asset-only multiplier/announcements). Last admin can only exit via `renounceLastAdmin()`; `initialAdmin == address(0)` = launch admin-less.
- **PolicyRegistry singleton precompile**: policies by uint64 id `[8-bit PolicyType][56-bit counter]`. Types: BLOCKLIST, ALLOWLIST, UNION, INTERSECT. Built-ins: ALWAYS_ALLOW=0, ALWAYS_BLOCK=(ALLOWLIST<<56)|1. Two-step admin transfer; `renounceAdmin` freezes policy.
- Policy scopes on tokens: TRANSFER_SENDER/RECEIVER/EXECUTOR, MINT_RECEIVER, SEIZE_HOLDER/RECEIVER. Default ALWAYS_ALLOW. approve/permit NOT policy-gated.
- Memos: `transferWithMemo`, `mintWithMemo`, etc. emit `Memo(caller, bytes32 memo)` right after primary event; indexers join by (txHash, logIndex-1).
- Granular pause by PausableFeature: TRANSFER, MINT, BURN, SEIZE.
- Supply cap: `type(uint128).max` = no cap.
- ERC-2612 permit (EIP-712 version "1"; ERC-1271 NOT accepted), ERC-7572 contractURI.
- Variants: **Asset** (RWA: precision, distributions, multiplier/split, holder restrictions) and **Stablecoin** (mint/burn, compliance, reconciliation).

## Payments (accept-payments lifecycle)
- Lifecycle: Request → Authorize (EIP-3009 exact auth) → Capture (incl. partial) / Void → Verify (confirm logs, claim order once) → Refund / Payout / Split (basis-point shares).
- Agentic: x402 `exact` for fixed-price APIs, x402 `upto` for usage-based (authorize max, settle measured), voucher channels for high-frequency batching, spend-policy checks before agent signs.

## Agent resources (mirrors our own agent strategy)
- Docs MCP server: `https://docs.base.org/mcp` (Streamable HTTP).
- Static files: llms.txt (index), llms-full.txt (full), any page + `.md` suffix.
- Skills repo: `npx skills install base/skills -g` (github.com/base/skills).
- Base MCP (wallet primitives): /agents/overview — pairs with our base-mcp-integration reference.

## DeFi & services
- Integrate guides: 0x Swap API trading, lending, borrowing, vault earn products.
- base-anvil CLI (Foundry toolchain for Base-native contracts), Base Services Hub, Base Batches accelerator, Base Ecosystem Fund.
