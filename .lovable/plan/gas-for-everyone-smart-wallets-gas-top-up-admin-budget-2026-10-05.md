# Gas for everyone: smart wallets + gas top-up + admin budget

## Goal
No user ever needs ETH. Smart wallets go through the existing sponsorship proxy; plain wallets (MetaMask etc.) get a tiny automatic ETH top-up. One monthly budget, adjustable in the admin panel, caps both.

## What the user sees
- Sign in with email/Google/Farcaster → a smart wallet is created automatically, all actions are free.
- Sign in with MetaMask/Rabby → before the first action without ETH, the app silently tops up a few cents of ETH ("Preparing free gas…"), then the action proceeds.
- When the monthly budget is spent → actions fall back to "pay your own gas" with a clear message (nothing breaks).

## Admin panel: new "Gas" tab
- Monthly budget (USD) — editable, saved instantly.
- On/off switches: sponsorship for smart wallets, top-ups for plain wallets.
- Top-up size (default $0.02 of ETH) and limit per wallet (default 1 per 7 days, max 3 per month).
- Spent this month, remaining, number of sponsored actions and top-ups, top wallet consumers.
- Gas wallet balance + its address so it can be refilled.

## Stage 1 — Smart wallets for all (Privy)
- Enable Privy smart wallets (Coinbase Smart Wallet type, Base) and wrap the app in the smart-wallets provider.
- Embedded wallets created for every login; actions from Privy users are sent from the smart wallet via our paymaster proxy.
- Users who log in with an external wallet keep their address for display; the app offers the smart wallet as the "free gas" account (existing active/primary wallet switching is reused).
- Requires a one-time switch in the Privy dashboard (I'll give exact steps).

## Stage 2 — Gas top-up for plain wallets
- New backend function `gas-drip`: authenticated user, verified wallet ownership, balance below threshold, not banned, has a real pending Loyal Spark action, within per-wallet and global budget → sends ETH from a dedicated gas wallet.
- Frontend: `useSponsoredSendTransaction` checks balance for non-smart wallets, requests a top-up, waits for it, then sends.
- Requires a new dedicated gas wallet (private key stored as a protected secret, funded with e.g. $20 ETH on Base).

## Stage 3 — Shared budget
- `gas_settings` table (single row): monthly budget, switches, top-up size, per-wallet limits. Admin-only writes.
- `gas_drips` log table; paymaster proxy and gas-drip both check "spent this month < budget" before sponsoring.
- Paymaster proxy starts recording estimated cost per sponsored operation (so the budget counts both).

## Technical details
- Tables: `gas_settings`, `gas_drips` (+ existing `gas_sponsorships`), RLS: admin read/write via `has_role`, service_role for functions; GRANTs included.
- ETH/USD price from an existing oracle/price fetch with cached fallback.
- Rate limits via existing `consume_wallet_rate_limit`.
- Tests: budget exhausted → refused; per-wallet limit; wallet with ETH → no top-up; non-admin cannot change budget.

## Needed from you
1. Turn on Smart Wallets in the Privy dashboard (steps provided at implementation).
2. Create/fund a dedicated gas wallet and paste its private key into the secure form (never in chat).
3. Initial monthly budget (default $50).
