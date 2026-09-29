---
name: Base Cobalt upgrade
description: Cobalt hardfork (mainnet 2026-09-30 18:00 UTC) — B20 fee payment, Union/Intersect policies, validity transactions; opportunities for LoyalSpark gasless UX
type: reference
---

Studied 2026-09-29. Cobalt = Base hardfork after Beryl. Sepolia live 2026-09-23, Mainnet 2026-09-30 18:00 UTC (node v1.4.2+).

## Features relevant to LoyalSpark
- **Pay gas in B20 tokens** — users pay network fees in loyalty tokens, no ETH. Directly serves the gasless UX target.
- **Union/Intersect policies** — combinable allow/block lists on B20 tokens (transfer sender/receiver, mint receiver scopes).
- **Validity transactions** — tx included only when onchain predicates (balance, storage, block number, Flashblock index) match. Use for conditional voucher redemption, scheduled rewards.
- **EIP-8130 native AA** (gas sponsorship, batch calls, session keys) announced with Cobalt cycle; mainnet date for AA itself not confirmed separately.
- TEE registration migration + dynamic upgrades (metrics-only) — infra, no app impact.

## Ops notes
- Binance paused Base transfers 2026-09-30 17:00 UTC; avoid onchain ops/deploys in the 17:00–20:00 UTC window.
- Existing B20 + legacy ERC-20 programs keep working; no migration needed.
- Docs: https://docs.base.org/base-chain/specs/upgrades/cobalt/overview
