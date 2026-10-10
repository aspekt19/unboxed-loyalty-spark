# Roadmap

## Payment text review and targeted publication
- [x] Review commit 13ebddf0 against the unchanged five public keyless reads and pricing
- [x] Deploy x402-gateway, mpp-gateway, well-known-x402 and chat-bridge after explicit agreement; request site publication
- [x] Verify live payment instructions; 7 payment-key tests and 42 Concierge cases passed
- [ ] Confirm published static documents match reviewed source — waiting for scheduled site publication; first live check still served previous versions

## Switch human sign-in to Coinbase
- [x] Coinbase Google/email sign-in + external wallets dialog, Privy removed
- [x] Free gas for Coinbase smart accounts via paymaster-proxy
- [x] Backend sign-in check (cdp-auth), old Privy function and secret removed
- [x] CDP Project ID added (public, in `src/config/cdp.ts`)
- [x] Real Google and email login confirmed by the user on loyalspark.online
- [x] Wipe test human data — done as a one-off data cleanup (no migration): only Privy-created sign-ins and their links removed; MetaMask/external-wallet users kept by user decision
- [x] Replace "Privy" wording on legal / guide / FAQ / pitch pages, docs and assistant knowledge
- [x] Phone removed from sign-in and recipient lookup; QR reads 0x addresses, ethereum: URIs and mailto:
- [x] Fresh sign-in clears the "signed out on purpose" flag (email login no longer bounces back to Sign in)
- [ ] Sponsored (gas-free) voucher activation from a Google/email account — waiting for the user to try it live

## Landing color and hero 3D background
- [x] Replace violet palette with Base Blue across tokens (later superseded by user request)
- [x] Recolor to the agent-chosen palette: graphite black + orange spark, hero ink panel
- [x] Add a massive 3D animation behind the hero headline (React Three Fiber, background only)
- [x] Verify in browser (light + dark); dark-mode icon and logo contrast fixed
- [x] Site-wide page surface: warm glow + faint mesh on html (fixed), opaque page wrappers made transparent
- [x] Loyalty-themed hero animation: stamp card filling with stamps + reward coin + floating gift cards
- [ ] Confirm with the user that the new surface reads well; tune glow strength if it still looks white
