# Roadmap

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
