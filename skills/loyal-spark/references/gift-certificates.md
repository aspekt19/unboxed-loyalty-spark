# Gift Certificates (`LOYAL-XXXXXX`)

UDS-style printable / shareable codes that a merchant issues and a customer claims into their wallet.

## States

```
active → pending_mint → redeemed
       ↘ revoked
```

- **active** — issued, unclaimed. Anyone with the code can preview it via `lookup_gift_certificate` (no auth required for preview).
- **pending_mint** — claimed by a wallet (`claim_gift_certificate`) but not yet minted onchain.
- **redeemed** — claimed and minted. Merchant calls `mark_gift_certificate_minted({ code, mint_tx_hash })` after broadcasting the mint transaction.
- **revoked** — merchant cancelled before claim (`revoke_gift_certificate`). Only `active` certificates can be revoked.

## Merchant tools (`lsk_`)

| Tool | Notes |
| --- | --- |
| `create_gift_certificate` | Single or batch up to **100** per call. Returns array of codes. Confirm the count with the user before issuing a batch. |
| `list_gift_certificates` | Includes status and redemption info. |
| `revoke_gift_certificate` | `active` only. |
| `mark_gift_certificate_minted` | Required to move `pending_mint` → `redeemed`. Otherwise certificate stays in claimed-but-unminted state. |

Scopes: `manage_rewards` for create/revoke/mark-minted, `read` for list.

## Recipient tools (`rwk_`)

| Tool | Notes |
| --- | --- |
| `lookup_gift_certificate({ code })` | Preview by code. No bind. |
| `claim_gift_certificate({ code })` | Binds the certificate to the caller's bound wallet. Transitions `active → pending_mint`. |
| `list_my_gift_certificates` | Everything claimed by this wallet. |

## Automation

Merchants can set an **auto-issue** automation rule: when a new customer wallet is first seen by the program, a welcome certificate of N points is auto-created and emailed/messaged. Tools/UI surface this; agents do not need to wire it themselves.

## Format

Codes match `^LOYAL-[A-Z0-9]{6}$` — case-insensitive on lookup, always uppercase in storage.
