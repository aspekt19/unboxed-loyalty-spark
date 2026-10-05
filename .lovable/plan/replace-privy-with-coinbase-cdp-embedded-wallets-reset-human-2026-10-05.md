# Replace Privy with Coinbase (CDP Embedded Wallets) + reset human accounts

## Goal
Humans sign in with Google or email through Coinbase and automatically get a Coinbase smart wallet with free gas (CDP Paymaster, free quota up to $10k/month on Base). External wallets (MetaMask, Coinbase Wallet, Base App, Farcaster) stay as an alternative login and pay their own gas. Privy is removed completely. All test human data is wiped; AI agents are untouched.

## What does NOT change for AI agents
- `lsk_` / `rwk_` API keys, SIWE agent registration, REST/MCP, x402/MPP gateways, `agent-prepare`, agent plans, CDP server (MPC) agent wallets.
- Tables kept as-is: `agent_registry`, `agent_wallets`, `agent_plans`, `agent_plan_subscriptions`, `agent_usage`, `agent_fee_*`, `agent_activity_log`, `recipient_agent_*`, `agent_reports`, all plan/price/settings tables.
- Admin wallets 0x5cc0...6205 and 0x40a8...ad8b keep working via external wallet login.

## What you need to do (once, in Coinbase Developer Platform)
1. Embedded Wallets -> enable, turn on **Google** and **Email** sign-in, account type **Smart account**.
2. Domains allowlist: `https://loyalspark.online`, `https://loyaltyspark.lovable.app`, the preview domain, `http://localhost:8080`.
3. Send me the **CDP Project ID** (public, safe to put in code).
4. Paymaster -> allowlist our contracts (already done for the proxy).

## Steps
1. **Login UI**: new sign-in dialog — Google, Email (one-time code), "Connect wallet" (MetaMask / Coinbase Wallet / Base App). Inside Farcaster/Base App the host wallet is used automatically, as now.
2. **Wallet layer**: swap Privy providers for Coinbase CDP React + CDP wagmi connector; external connectors stay in wagmi.
3. **Free gas**: `useSponsoredSendTransaction` sends Coinbase smart-account calls through our `paymaster-proxy` (Loyal Spark contracts only, zero ETH, monthly budget from admin panel). External wallets send plain transactions.
4. **Backend sign-in**: new `cdp-auth` function verifies the Coinbase access token server-side and creates the app session/profile (same shape privy-auth produced). External wallets keep SIWE (`siwe-nonce`/`siwe-verify`).
5. **Linked identities / resolve-recipient**: email from Coinbase login is stored in `identity_links`, so "send tokens by email" keeps working.
6. **Remove Privy**: delete `privy-auth` function, Privy packages, Privy hooks/components, `PRIVY_APP_SECRET`; update texts on legal/guide/FAQ/for-agents pages and Concierge knowledge (rebuild).
7. **Data reset (human only)**: delete auth users that are not agents, plus `profiles`, `user_roles` (non-admin rows), `identity_links`, `customer_*`, `merchant_*` (profiles, branches, employees, invites, plan subscriptions), `loyalty_programs`, `rewards`, `vouchers`, `token_mint_history`, `gift_certificates`, `marketplace_offers`, `referral*`, `reviews*`, `marketing_campaigns`, `notification_history`, `personalized_offers`, `automation_*`, `premium_*` (user rows), `gas_sponsorships`, `traffic_sources`. Programs/merchants owned by an agent owner_address are kept. Onchain tokens remain on old addresses (cannot be deleted).
8. **Verify**: build, transaction tests, mobile tests, login smoke in preview; one real sponsored voucher activation after you sign in.

## Technical details
- Packages: add `@coinbase/cdp-react`, `@coinbase/cdp-hooks`, `@coinbase/cdp-wagmi`, `@coinbase/cdp-core`; remove `@privy-io/react-auth`, `@privy-io/wagmi`.
- Smart account sends use `useSendUserOperation` with `paymasterUrl = https://api.loyalspark.online/paymaster-proxy`; batching supported (approve + action in one op).
- `cdp-auth` uses `@coinbase/cdp-sdk` `validateAccessToken` with existing `CDP_API_KEY_ID/SECRET`.
- `agent-wallet` holder delegated-wallet comment/flow referencing Privy is updated to Coinbase identity; agent paths unchanged.
- AGENTS.md (root, hooks, functions) and memory (Hybrid Identity, Privy Deployment, Session Management, Gasless UX) updated to Coinbase.
- Reset is done with data queries after the new login ships, so nobody is locked out mid-change.
