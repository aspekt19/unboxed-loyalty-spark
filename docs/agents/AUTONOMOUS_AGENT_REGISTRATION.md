# Autonomous merchant agents — free `lsk_` via SIWE

Autonomous agents (no human in the browser) can obtain a merchant **API key** the same way as **recipient** agents: **SIWE** + **nonce** from `siwe-nonce`.

## Endpoints

| Step | Method | URL |
|------|--------|-----|
| Nonce | POST | `{SUPABASE_URL}/functions/v1/siwe-nonce` |
| Register | POST | `{SUPABASE_URL}/functions/v1/agent-register-siwe` |

Use header `apikey: {VITE_SUPABASE_PUBLISHABLE_KEY}` (anon key) on `siwe-nonce` if your client requires it — same as recipient flow.

## SIWE message (EIP-4361)

The signed message **must**:

1. Include the exact phrase: **`Register Loyal Spark merchant agent`**
2. Include **`Chain ID: 8453`** (Base mainnet)
3. Include the **`Nonce:`** line from `siwe-nonce` (single-use, ~5 minutes)
4. Use **`Issued At:`** within ~5 minutes of submission

Example template (replace `YOUR_NONCE` and adjust `Issued At`):

```
loyalspark.online wants you to sign in with your Ethereum account:
0xYourWalletAddress

Register Loyal Spark merchant agent

URI: https://loyalspark.online
Version: 1
Chain ID: 8453
Nonce: YOUR_NONCE
Issued At: 2026-04-11T12:00:00.000Z
```

Sign with the **same** `0xYourWalletAddress` wallet. `owner_address` in `agent_registry` will be that address (lowercase).

## Register request body

```json
{
  "message": "<full SIWE string>",
  "signature": "0x...",
  "name": "My autonomous agent",
  "description": "optional",
  "scopes": ["read", "mint", "create_program"]
}
```

If `scopes` is omitted or empty, default is **`["read"]`**. Allowed values: `read`, `create_program`, `mint`, `trade`, `manage_rewards`.

## Limits

- Up to **10** agents per wallet address (same as dashboard).
- Nonce replay protection via `siwe_nonces`.
- Usage and billing follow the same **agent plans** as keys created in the merchant UI.

## Upgrading plan (same as humans)

Billing is keyed by **`owner_address`**, not by “logged in via Privy or not”. Autonomous agents use the same **`verify-agent-plan-payment`** Edge Function:

1. `POST` body `{ "action": "get_payment_info", "product": "agent" }` → subscription wallet address + `agent_plans` (slugs, USDC/month).
2. Send **USDC on Base** to that wallet for the chosen plan amount.
3. `POST` body `{ "action": "verify_payment", "product": "agent", "transaction_hash": "0x...", "plan_slug": "<slug>", "owner_address": "<same wallet as SIWE / lsk_ owner>" }`.

On success, **`agent_registry.plan_id`** is updated for every agent with that **`owner_address`** (same behavior as the merchant billing UI).

## See also

- [QUICKSTART.md](./QUICKSTART.md)
- Recipient-only flow (no merchant): `POST …/recipient-api/register` with `rwk_` keys
