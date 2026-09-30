---
name: Base Cobalt upgrade
description: Cobalt hardfork (live on mainnet 2026-09-30) — validity transactions, B20 Union/Intersect policies, multiplier, seize; NO gas-in-B20
type: reference
---

Rechecked 2026-09-30 against the official spec. Cobalt is live on Base mainnet (2026-09-30), Sepolia since 2026-09-23.

## Actually in Cobalt
- **Validity transactions** — tx included only when onchain predicates (balance, storage, block number, Flashblock index) match.
- **B20 changes** — Union/Intersect composite policies, scheduled multiplier updates (ERC-8056), seize surface + burnBlocked deprecation.
- Dynamic upgrades (metrics-only), TEE registration migration — no app impact.

## NOT in Cobalt
- Paying gas in B20 tokens is NOT part of Cobalt (earlier note was wrong). Plan Stage 1 "gas in points" cannot ship on Cobalt.
- EIP-8130 native AA not part of Cobalt.

Docs: https://docs.base.org/base-chain/specs/upgrades/cobalt/overview · B20 changelog: https://docs.base.org/base-chain/specs/reference/b20/changelog
