# Gasless Loyal Spark + Shopify connection in a few clicks

Goal: shoppers and merchants never pay network fees, and a Shopify store connects to Loyal Spark with Install → Approve → pick a program.

## Stage 1 — Base Paymaster (we pay all network fees)

What changes for people:
- Shoppers redeem vouchers, transfer points and use escrow without holding ETH.
- Merchants create programs, mint and manage them without holding ETH.
- Every sponsored action is recorded per merchant, so a monthly limit can be added later with one setting (left open for now).

How:
- Base Paymaster from Coinbase Developer Platform; the merchant needs a Paymaster URL from their CDP account (stored as a secret, never in code).
- Wallet sends switch to batched calls with the paymaster capability (EIP-5792 `wallet_sendCalls` + `paymasterService`) when the wallet supports it (Base Account, Privy smart wallets). Older wallets keep the current flow and pay their own gas.
- A small backend proxy for the Paymaster that only sponsors calls to our contracts: loyalty tokens registered in our database, the B20 factory, legacy factory, escrow. Anything else is rejected.
- Sponsorship log table (merchant, wallet, action, tx hash, gas cost) with a nullable monthly cap per plan.
- Server-side mints (CDP agent wallets) already pay gas from our side — no change.

## Stage 2 — Shopify app (private install link for partners)

Merchant flow:

```text
Install link -> Shopify approve screen -> Loyal Spark sign-in -> choose program + cashback -> done
```

Shopper flow:
- Rewards widget on the store (theme app extension, toggled on in the theme editor).
- Paid order -> points credited automatically to the shopper's wallet, found by order email (wallet auto-created via existing email resolution; no ETH, no seed phrase).
- Redeem: shopper picks a reward -> voucher issued -> converted into a one-time Shopify discount code shown in the widget and usable at checkout.
- Refund/cancel -> points from that order reversed when possible.

Merchant side in our portal: new "Shopify" card in Settings showing connected store, chosen program, last synced orders, disconnect button.

How:
- Shopify custom-distribution app (no App Store review for now); OAuth install, `orders/paid`, `refunds/create`, `app/uninstalled` webhooks with HMAC check (Shopify webhooks must be verified — separate from the miniapp webhook rule).
- Backend functions: `shopify-oauth` (install + callback), `shopify-webhooks` (orders → earn via existing fee-first mint through the merchant's CDP server wallet), `shopify-redeem` (voucher → Admin API discount code).
- Tables: `shopify_shops` (shop domain, encrypted access token, merchant, program, cashback), `shopify_order_awards` (idempotency per order).
- Mint fee rules, Free plan 1,000 tokens/mo cap and program-expiry checks reused as-is.
- Theme app extension code lives in a separate folder for upload via Shopify CLI (Lovable cannot publish it to Shopify; you run one command or I give exact steps).

## What I need from you
1. Coinbase Developer Platform: Paymaster URL for Base mainnet (added through the secure form).
2. Shopify Partner account: create an app, give me the Client ID and Client secret (secure form). I will give you the redirect and webhook URLs to paste.

## Not in scope
- Shopify App Store listing (later).
- Gas paid in loyalty points (Cobalt stage 1 stays postponed).
- Monthly sponsorship limits values (structure ready, values later).

## Technical notes
- Docs updated: skills, llms.txt, OpenAPI, Concierge knowledge (new "Gasless" and "Shopify" sections).
- Tests: paymaster allowlist rejects non-Loyal-Spark targets; order webhook awards points once per order; refund reverses; HMAC rejection.
- AGENTS.md: record paymaster proxy allowlist rule and Shopify function layout.
