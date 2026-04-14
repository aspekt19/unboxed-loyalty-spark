import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Suppress wagmi/viem RPC reconnect errors that appear when a previously
// connected wallet (e.g. MetaMask) is no longer available in the current browser.
window.addEventListener('unhandledrejection', (event) => {
  const msg = event.reason?.message || event.reason?.toString?.() || '';
  if (
    msg.includes('connector error') ||
    msg.includes('Unknown RPC') ||
    msg.includes('connector not found') ||
    msg.includes('unknown RPC')
  ) {
    event.preventDefault();
  }
});

window.addEventListener('error', (event) => {
  const msg = event.message || '';
  if (
    msg.includes('connector error') ||
    msg.includes('Unknown RPC') ||
    msg.includes('unknown RPC')
  ) {
    event.preventDefault();
  }
});

createRoot(document.getElementById("root")!).render(<App />);
