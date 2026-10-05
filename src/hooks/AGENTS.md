# Hooks rules

- `useSponsoredSendTransaction` sponsors gas only when the active wallet is a Privy smart wallet or the Privy embedded wallet (Privy native `sponsor: true`), so tokens are spent from the address that holds them; external wallets pay their own gas and we never send ETH to users.
