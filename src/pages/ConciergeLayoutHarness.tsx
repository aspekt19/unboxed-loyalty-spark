import { ConciergeDock } from "@/components/assistant/ConciergeDock";

/**
 * Test-only page (dev server or VITE_E2E=1 builds). Opens the real chat window
 * without sign-in so e2e/concierge-mobile-layout.spec.ts can measure it on phone sizes.
 */
export default function ConciergeLayoutHarness() {
  const role = new URLSearchParams(window.location.search).get("role") === "merchant" ? "merchant" : "shopper";
  return (
    <div className="min-h-screen bg-background">
      <ConciergeDock role={role} testOpen />
    </div>
  );
}
