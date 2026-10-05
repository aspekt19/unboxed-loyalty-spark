# Clean up desktop wallet sign-in

## Changes
- Collapse duplicate browser-injected wallets into one **Browser wallet** option.
- Keep **Coinbase Wallet / Base App** as its own option.
- Keep **Other wallets** through WalletConnect for the full wallet picker and desktop QR code.
- Preserve the current mobile behavior.

## Verification
- Check the desktop sign-in dialog visually.
- Confirm mobile still routes through WalletConnect without showing an unavailable browser wallet.
- Run the focused type check and review the preview build status.
