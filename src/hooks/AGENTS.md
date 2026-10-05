# Hooks rules

- Human sign-in goes through `useIdentity` (Coinbase CDP Embedded Wallets for Google/email + wagmi external wallets); no other wallet SDK — why: one identity layer, CDP Paymaster gives free gas.
- `useSponsoredSendTransaction` sponsors gas only when the active wallet is the user's Coinbase smart account (user operation via our `paymaster-proxy`), so tokens are spent from the address that holds them; external wallets pay their own gas and we never send ETH to users.
