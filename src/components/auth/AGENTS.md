# Auth components

- Do not call `verifyOAuth` on the Google return; the Coinbase SDK verifies the single-use code itself — why: a second verify always fails and showed a false "sign-in didn't finish".
- Never change the URL (pushState/replaceState/navigate) while `isOAuthReturnPending()` is true — why: the SDK reads `flow_id`/`code` asynchronously; stripping them early silently aborts Google sign-in.
- Report Google failures from the SDK's `onOAuthStateChange` error, not only a timeout — why: the real reason must reach the user and the console.
