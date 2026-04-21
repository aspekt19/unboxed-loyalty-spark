import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import {
  dispatchWalletConnectorRecovery,
  isWalletConnectorFailureMessage,
  walletConnectorFailureText,
} from "./lib/walletConnectorErrors.ts";

// Wagmi/viem reconnect failures (e.g. MetaMask missing in in-app browsers): notify the app
// so it can clear persisted wagmi/Privy state and show Sign in again — then suppress noise.
window.addEventListener('unhandledrejection', (event) => {
  const msg = walletConnectorFailureText(event.reason);
  if (!isWalletConnectorFailureMessage(msg)) return;
  dispatchWalletConnectorRecovery();
  event.preventDefault();
});

window.addEventListener('error', (event) => {
  const msg = event.message || '';
  if (!isWalletConnectorFailureMessage(msg)) return;
  dispatchWalletConnectorRecovery();
  event.preventDefault();
});

createRoot(document.getElementById("root")!).render(<App />);

// Notify Farcaster / Base App webview that the UI is ready as early as possible.
// If we wait for Privy/wagmi to initialize, slow iframe loads keep the host
// splash screen up and the user sees a white screen. This is safe outside of
// Farcaster clients — the SDK no-ops when not embedded.
(async () => {
  try {
    const { sdk } = await import('@farcaster/miniapp-sdk');
    await sdk.actions.ready();
  } catch {
    // Not in a Farcaster/Base client, or SDK unavailable — ignore.
  }
})();
