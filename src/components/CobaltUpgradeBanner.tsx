import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { isInCobaltMaintenance, shouldShowCobaltNotice } from "@/lib/cobalt";

export function CobaltUpgradeBanner() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  if (!shouldShowCobaltNotice(now)) return null;
  const active = isInCobaltMaintenance(now);

  return (
    <div role="status" className="w-full border-b border-border bg-muted text-foreground">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2 text-sm">
        <AlertTriangle className="h-4 w-4 shrink-0 text-primary" />
        <span>
          {active
            ? "Base network upgrade in progress. Program deploys, minting and P2P escrow are paused until 19:00 UTC."
            : "Base network upgrade on Sep 30, 17:30–19:00 UTC. Onchain actions will be paused briefly; your tokens are safe."}
        </span>
      </div>
    </div>
  );
}
