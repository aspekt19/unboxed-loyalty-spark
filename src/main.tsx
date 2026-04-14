import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { WALLET_CONNECTOR_ERROR_EVENT } from "./constants/walletConnectorRecovery.ts";

function connectorFailureMessage(reason: unknown): string {
  if (reason == null) return '';
  if (typeof reason === 'string') return reason;
  if (reason instanceof Error) {
    const parts = [reason.message, (reason as Error & { cause?: unknown }).cause]
      .filter(Boolean)
      .map((x) => (typeof x === 'string' ? x : (x as Error)?.message ?? String(x)));
    return parts.join(' ');
  }
  try {
    return String(reason);
  } catch {
    return '';
  }
}

function isWalletConnectorFailureMessage(msg: string): boolean {
  const m = msg.toLowerCase();
  return (
    m.includes('connector error') ||
    m.includes('unknown connector') ||
    m.includes('unknown rpc') ||
    m.includes('connector not found')
  );
}

// Wagmi/viem reconnect failures (e.g. MetaMask missing in in-app browsers): notify the app
// so it can clear persisted wagmi/Privy state and show Sign in again — then suppress noise.
window.addEventListener('unhandledrejection', (event) => {
  const msg = connectorFailureMessage(event.reason);
  if (!isWalletConnectorFailureMessage(msg)) return;
  window.dispatchEvent(new CustomEvent(WALLET_CONNECTOR_ERROR_EVENT));
  event.preventDefault();
});

window.addEventListener('error', (event) => {
  const msg = event.message || '';
  if (!isWalletConnectorFailureMessage(msg)) return;
  window.dispatchEvent(new CustomEvent(WALLET_CONNECTOR_ERROR_EVENT));
  event.preventDefault();
});

createRoot(document.getElementById("root")!).render(<App />);
