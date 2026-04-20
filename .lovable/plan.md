
## Plan: Native apps for App Store and Google Play

### Architecture
One codebase → two entry points via URL parameter/routing:
- **Loyal Spark** (`app.loyalspark.shopper`) — shopper interface
- **Loyal Spark Business** (`app.loyalspark.business`) — merchant interface

### Steps

1. **Install Capacitor** — `@capacitor/core`, `@capacitor/cli`, `@capacitor/ios`, `@capacitor/android`

2. **Create two app modes** — add `/app/shopper` and `/app/business` routes that immediately show the relevant interface without a role-selection step

3. **Configure Capacitor** — `capacitor.config.ts` with the appId for the Shopper build (primary). For the Business build — instructions on how to swap the config

4. **Adapt navigation** — remove the role selector in native mode and show the correct interface directly

5. **User instructions** — how to build both apps via Xcode / Android Studio

### What we are NOT doing right now
- Publishing to the stores (requires developer accounts)
- POS integration (next phase)
- Push notifications (next phase)
