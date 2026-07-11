# Loyalty program contracts (B20 default + legacy ERC-20)

Canonical reference for **how a loyalty program is created on Base mainnet** (chain ID 8453) as of the Beryl / B20 rollout.

Source of truth in code:

- B20 encoders: `src/config/b20.ts`, `supabase/functions/_shared/b20-encoding.ts`
- Legacy factory ABI: `src/config/contracts.ts`
- API routing: `supabase/functions/agent-api/index.ts` (`POST /programs`, `/register-program`, `/activate-program`)
- Merchant UI: `src/components/CreateLoyaltyProgram.tsx` → `useDeployB20Token.ts`
- DB field: `loyalty_programs.token_standard` — `b20` (default) or `erc20` (legacy)

Agent-facing playbooks: `public/.well-known/skills/01-create-loyalty-program.md`, `13-endpoint-workflows.md`.

---

## Default path — B20 (new programs)

**What gets called:** Base’s native **B20 Factory precompile** (not a Loyal Spark–deployed contract).

| Role | Address |
|------|---------|
| B20 Factory | `0xB20f000000000000000000000000000000000000` |
| Created token | `0xB200…` (deterministic; variant encoded in address) |

**On-chain call:** `createB20(variant, salt, params, initCalls)` on the factory.

- `variant`: `ASSET` for loyalty points (default).
- `initCalls`: typically `grantRole(MINT_ROLE, merchant)` and optional extra minters (e.g. CDP agent wallet).
- **One transaction** — token is usable after deploy; **no** `unpauseUtility` / `enableMinting`.
- Event: `B20Created(address,uint8,string,string,uint8,bytes)` — token address in `topic[1]`.

**Off-chain steps:**

1. `POST /agent-api/programs` (or MCP `create_loyalty_program`) — omit `token_standard` or set `"b20"`.
2. Broadcast returned calldata (Builder Code `bc_wdmnog7m` suffix on calldata from platform).
3. `POST /register-program` with `token_standard: "b20"` → DB `status: active`.
4. Create rewards → mint / earn.

**Skip:** `POST /activate-program` returns a no-op for B20 (`already_active: true`).

**Merchant portal:** always uses B20 (`useDeployB20Token`).

---

## Legacy path — Loyal Spark ERC-20 factory

**When:** `token_standard: "erc20"` on `POST /programs` (API/MCP only; portal does not offer this).

| Role | Address |
|------|---------|
| LoyaltyTokenFactory | `0x5F3DdBa12580CFdc6016258774cCc19C4250dA80` |
| Implementation (logic) | `0xe6BA426C9c51281B929a17444De02c65815E27C3` |
| Created token | New minimal proxy per deploy |

**On-chain call:** `createLoyaltyToken(name, symbol, merchantAddress)` on the factory.

- Event: `LoyaltyTokenCreated`.
- DB registers as `token_standard: "erc20"`, `status: inactive`.

**Activation required (legacy only):**

1. `POST /activate-program` → two txs: `unpauseUtility` + `enableMinting`.
2. `POST /program-status` with `active`.

Existing programs created before B20 remain on this path until migrated (not automatic).

---

## After creation — same for both standards

Mint, transfer, rewards, vouchers, P2P, and x402 corridors use **ERC-20–compatible** interfaces on the **program token address**. B20 is an ERC-20 superset at the ABI level for balances, `transfer`, `mint(address,uint256)`, etc.

| Contract | Address | Purpose |
|----------|---------|---------|
| LoyaltyTokenEscrow | `0xA569C95AfC1BCF381c48BcF336ED9D2c014bcdDF` | P2P atomic swaps |
| Platform fee on mint | Same token contract | Second `mint` tx to fee wallet (plan %) |

---

## Quick decision table

| Question | B20 (default) | Legacy ERC-20 |
|----------|---------------|---------------|
| Factory / deploy target | `0xB20f…` (Base) | `0x5F3DdB…` (Loyal Spark) |
| Deploy txs | 1 | 1 |
| Activation txs | 0 | 2 |
| `activate-program` | No-op | Required |
| Token address pattern | `0xB200…` | Proxy (varies) |
| Portal “Create program” | Yes | No (API opt-in) |
| `token_standard` in DB | `b20` | `erc20` |

---

## API examples

**B20 (default):**

```bash
curl -sS -X POST "https://api.loyalspark.online/agent-api/programs" \
  -H "x-api-key: $LSK" -H "Content-Type: application/json" \
  -d '{"name":"Coffee Rewards","symbol":"COFFEE","token_standard":"b20"}'
```

**Legacy:**

```bash
curl -sS -X POST "https://api.loyalspark.online/agent-api/programs" \
  -H "x-api-key: $LSK" -H "Content-Type: application/json" \
  -d '{"name":"Legacy Shop","symbol":"LEG","token_standard":"erc20"}'
```

---

## Docs to keep in sync when this changes

- `README.md` (Smart Contract Architecture)
- `public/llms.txt`, `public/llms-full.txt`
- `public/openapi.json` (+ `scripts/generate-openapi.mjs` if regenerated)
- `skills/loyal-spark/references/calldata-flow.md`
- `public/.well-known/skills/01-create-loyalty-program.md`
