# Skill: B20 Native Spec (Beryl) for Loyalty Tokens

## Goal
Understand what a Loyal Spark **B20** loyalty token actually is at the chain level, so an agent can reason about roles, policies, pausing, memos and permits without guessing.

Source of truth: Base docs → `/specifications/b20/specification-overview` ("Beryl" spec). Loyal Spark deploys the **Asset** variant.

## Required Scope
`read` (informational) — writes below still need `mint` / `create_program`.

## 1. Deployment model

- B20 is an **ERC-20 superset implemented as chain-native Rust precompiles** — no custom contract, no audit surface, no proxy.
- Every token is created through the singleton **factory precompile**:
  `createB20(uint8 variant, bytes32 salt, bytes params, bytes[] initCalls)` at
  `0xB20f000000000000000000000000000000000000` (same address on Base Mainnet 8453 and Sepolia 84532).
- Address is deterministic: `getB20Address(variant, sender, salt)` — an agent can precompute the token address **before** broadcasting.
- `isB20(token)` returns whether an arbitrary address is a native B20.
- Variants: `0 = Asset` (used by Loyal Spark loyalty points), `1 = Stablecoin`.
- `initCalls` run atomically inside the deploy tx. Loyal Spark uses them to grant `MINT_ROLE` to the merchant admin **and** the agent's CDP wallet in the same transaction (`extra_minters`).

## 2. Roles

| Role | Meaning for a loyalty program |
|------|-------------------------------|
| `DEFAULT_ADMIN` | Merchant owner; grants/revokes every other role |
| `MINT` | Issues points (merchant wallet + agent CDP wallet) |
| `BURN` | Redemption / expiry burns |
| `SEIZE` | Compliance clawback (unused by default) |
| `PAUSE` / `UNPAUSE` | Freeze a specific feature (see §4) |
| `METADATA` | Update name / symbol / `contractURI` (ERC-7572) |
| `OPERATOR` | Asset-variant only: multiplier / split / announcements |

`MINT_ROLE = keccak256("MINT_ROLE")` = `0x154c00819833dac601ee5ddded6fda79d9d8b506b911b3dbd54cdb95fe6c3686`.

Admin exit rules:
- The **last** admin can only leave via `renounceLastAdmin()`.
- Deploying with `initialAdmin == address(0)` launches the token **admin-less** (immutable) — Loyal Spark never does this for merchant programs, because expiry burns and role grants would become impossible.

## 3. Policies (PolicyRegistry precompile)

- Policies live in a **singleton PolicyRegistry**, referenced by `uint64` id encoded as `[8-bit PolicyType][56-bit counter]`.
- Types: `BLOCKLIST`, `ALLOWLIST`, `UNION`, `INTERSECT`.
- Built-ins: `ALWAYS_ALLOW = 0`, `ALWAYS_BLOCK = (ALLOWLIST << 56) | 1`.
- Token scopes that can point at a policy: `TRANSFER_SENDER`, `TRANSFER_RECEIVER`, `TRANSFER_EXECUTOR`, `MINT_RECEIVER`, `SEIZE_HOLDER`, `SEIZE_RECEIVER`.
- **Default for Loyal Spark programs: `ALWAYS_ALLOW` on every scope** — loyalty points stay freely transferable, so the P2P escrow marketplace and voucher flows work unchanged.
- `approve` / `permit` are **not** policy-gated; only the transfer itself is.
- Admin transfer of a policy is two-step; `renounceAdmin` freezes the policy permanently.

> Agent rule: if a transfer reverts on a B20 program, check the policy id on `TRANSFER_SENDER`/`TRANSFER_RECEIVER` before assuming a balance problem.

## 4. Granular pause

Pause is per `PausableFeature`, not global: `TRANSFER`, `MINT`, `BURN`, `SEIZE`.
A merchant can stop issuance (pause `MINT`) while customers keep spending existing points (`TRANSFER` still live). Loyal Spark's program-expiry logic is enforced in the backend (`check_program_expiration()`), not by pausing.

## 5. Memos — recommended for loyalty attribution

B20 adds memo-carrying variants: `transferWithMemo`, `mintWithMemo`, `burnWithMemo`, …

- Each emits `Memo(address caller, bytes32 memo)` **immediately after** the primary `Transfer` event.
- Indexers join by `(txHash, logIndex - 1)`.
- Use for order ids, voucher codes, campaign ids: `memo = keccak256("order:12345")` or a 32-byte raw ASCII tag.

Loyal Spark currently emits standard `mint` / `transfer` calldata (no memo). If your agent needs onchain attribution today, sign the memo variant yourself against the token address returned by `register-program`; a first-class `memo` field on `POST /agent-api/mint` is a roadmap item.

## 6. Other spec facts worth knowing

- **Supply cap**: `type(uint128).max` means "no cap". Loyal Spark leaves loyalty programs uncapped.
- **ERC-2612 permit**: EIP-712 domain version is `"1"`. **ERC-1271 (smart-contract) signatures are NOT accepted** for permit — an agent using a Base Account / smart wallet must call `approve` in a normal transaction instead of gasless permit.
- **ERC-7572** `contractURI` carries program branding.
- B20 is fully ERC-20 compatible: `balanceOf`, `transfer`, `transferFrom`, `allowance` behave exactly as agents expect, so every existing Loyal Spark read path (balances, tiers, escrow, vouchers) is unchanged.

## 7. Network facts

- Base Mainnet chainId **8453**, RPC `https://mainnet.base.org`, explorer `basescan.org`.
- **Flashblocks**: ~200 ms preconfirmations, sub-second confirmation, sub-cent fees. Agents should poll receipts at ~250–500 ms rather than the 2 s default of most SDKs.
- **Vibenet** is Base's demo network used in docs examples — Loyal Spark does **not** deploy there; use Base Sepolia (84532) for testing.

## Success criteria
- Agent can explain why a B20 transfer reverted (policy vs balance vs pause).
- Agent uses memos for order attribution instead of off-chain-only records.
- Agent never attempts ERC-1271 permit against a B20.

## Next skills
- [Create Loyalty Program](./01-create-loyalty-program.md)
- [Mint Tokens](./02-mint-tokens.md)
- [Payment Scenarios](./15-payment-scenarios.md)
