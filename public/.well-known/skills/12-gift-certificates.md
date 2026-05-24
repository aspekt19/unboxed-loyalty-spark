# Skill: Gift Certificates (UDS-style welcome / promo codes)

## Goal
Issue, manage and redeem **gift certificates** — pre-paid loyalty value identified by a 6-character `LOYAL-XXXXXX` code. A merchant agent issues the code (single or in batch), a recipient agent claims it, and the merchant mints loyalty tokens on-chain to the claimer's wallet.

## Required Scopes
- Merchant tools: `read` (list), `manage_rewards` (create, revoke), `mint` (mark minted)
- Recipient tools: none beyond a valid `rwk_` key (recipient agent is wallet-bound)

## End-to-End Agent Flow
1. **Merchant agent** issues a certificate
   - MCP: `create_gift_certificate { token_address, usd_amount, points_per_dollar?, max_redemption_percent?, title?, description?, expires_in_days?, image_url?, quantity? (1–100) }`
   - Returns one or many `{ id, code }` rows. Code format: `LOYAL-XXXXXX`.
2. Merchant shares the code with the customer (QR, link, hand-out, etc.).
3. **Recipient agent** previews the offer (optional)
   - MCP: `lookup_gift_certificate { code }` — returns title, USD/token amount, merchant, expiry, status. No claim happens.
4. **Recipient agent** claims it
   - MCP: `claim_gift_certificate { code }` — binds the certificate to the agent's bound wallet, transitions `active → pending_mint`.
5. Recipient shows the claim (or the wallet address) to the merchant.
6. **Merchant agent** mints loyalty tokens on-chain
   - MCP: `mint_loyalty_tokens { token_address, recipient: <claimer_wallet>, amount: <token_amount from certificate> }`
   - Submit returned calldata + fee tx.
7. **Merchant agent** marks the certificate as minted
   - MCP: `mark_gift_certificate_minted { certificate_id, transaction_hash }` — transitions `pending_mint → redeemed` and stores the mint tx.
8. **Recipient agent** can list its claims any time
   - MCP: `list_my_gift_certificates { status?, limit? }`

## Lifecycle

```
[create_gift_certificate] → status=active
        ↓ (recipient: claim_gift_certificate)
status=pending_mint, redeemed_by=<wallet>, redeemed_at=now
        ↓ (merchant: mint_loyalty_tokens on-chain)
        ↓ (merchant: mark_gift_certificate_minted with tx_hash)
status=redeemed, mint_tx_hash=0x…
```

Other terminal states: `revoked` (merchant `revoke_gift_certificate` while still `active`), `expired` (past `expires_at`).

## REST / Pay-per-call

All tools above are also reachable via the paid x402 corridor:

- Merchant: `POST https://api.loyalspark.online/x402-gateway/mcp-tools/<tool_name>` with `x-api-key: lsk_…`
- Recipient: `POST https://api.loyalspark.online/x402-gateway/recipient-mcp-tools/<tool_name>` with `x-api-key: rwk_…`

Body is standard MCP JSON-RPC `tools/call` (`{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"<tool>","arguments":{…}}}`). USDC on Base settles the 402 challenge.

## MCP Tools Used
- Merchant: `create_gift_certificate`, `list_gift_certificates`, `revoke_gift_certificate`, `mark_gift_certificate_minted`, `mint_loyalty_tokens`
- Recipient: `lookup_gift_certificate`, `claim_gift_certificate`, `list_my_gift_certificates`

## Notes
- `usd_amount * points_per_dollar` defines the token amount minted on redemption.
- `max_redemption_percent` (5–100) governs how much of any future purchase the customer can pay with these tokens.
- `quantity` allows batch issuance (1–100) for promotional drops; each row gets a unique `LOYAL-XXXXXX` code.
- A revoked or expired certificate cannot be claimed; an already-claimed one cannot be re-claimed.
