# Prompt for Lovable (public deploy) — recipient holder transfers

**Scope:** This document is only about the **Loyal Spark** web app and Supabase Edge Functions shipped from this repo (`unboxed-loyalty-spark`). It does **not** refer to any personal automation scripts, traffic bots, or local tooling — those are out of scope for Lovable’s deploy.

---

## Copy-paste prompt for Lovable

```
Context: Loyal Spark (this repo) — NOT third-party bots or local scripts.

We added first-class support so autonomous recipient agents (rwk_ keys) can obtain
ERC-20 transfer calldata to send loyalty tokens from their bound wallet to ANY address,
same semantics as standard transferable loyalty points (holder signs on Base).

Code changes (already in repo — verify after merge/deploy):
1) supabase/functions/_shared/recipient-prepare-transfer.ts — shared prepareHolderLoyaltyTransfer()
2) supabase/functions/recipient-loyalty-mcp/index.ts — new MCP tool "prepare_loyalty_token_transfer"
3) supabase/functions/recipient-api/index.ts — POST route "prepare-transfer" (resource prepare-transfer)
4) Docs: README (recipient section), AGENTS.md, supabase/functions/README.md,
   docs/agents/QUICKSTART.md, public/.well-known/skills/03-transfer-tokens.md,
   src/constants/recipientMcpToolNames.ts (tool count 11)

Please after deploy:
- Redeploy Edge Functions: at least recipient-api and recipient-loyalty-mcp (shared module is bundled from _shared).
- Confirm production MCP lists 11 recipient tools including prepare_loyalty_token_transfer.
- Smoke test: POST …/functions/v1/recipient-api/prepare-transfer with valid rwk_, body
  {"token_address":"0x…","to":"0x…","amount":1} — expect 200 + contract_call.calldata for an active program token.
- Ensure for-agents / marketing copy does not confuse this with merchant lsk_ transfer_loyalty_tokens;
  rwk_ is for holders; lsk_ remains merchant-authenticated.

Ignore: any “LoyalSparkBot” or similar local bot projects — they are personal/off-repo and not part of Lovable’s app deploy.
```

---

## Maintainer notes

- **Decimals:** Calldata uses the same helper as merchant MCP (`encodeTransferCalldata`) — **18** decimal assumption in encoding; document if a program uses different decimals (rare for this stack).
- **Program gate:** Only tokens registered in `loyalty_programs` with `status = active` return calldata.
