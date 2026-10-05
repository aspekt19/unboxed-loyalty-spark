# Auth components

- Do not call `verifyOAuth` on the Google return; the Coinbase SDK verifies the single-use code itself — why: a second verify always fails and showed a false "sign-in didn't finish".
