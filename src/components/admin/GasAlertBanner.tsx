import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, OctagonAlert } from "lucide-react";
import { useGasAlerts } from "@/hooks/useGasAlerts";

/**
 * Admin-wide banner: shows gas budget / gas wallet warnings on every admin
 * tab, not just the Gas tab. Renders nothing when everything is fine.
 */
export function GasAlertBanner() {
  const { alerts, loading } = useGasAlerts();
  if (loading || alerts.length === 0) return null;

  return (
    <div className="space-y-2 mb-4 sm:mb-6">
      {alerts.map((a) => (
        <Alert key={a.code} variant={a.level === "critical" ? "destructive" : "default"}>
          {a.level === "critical" ? (
            <OctagonAlert className="h-4 w-4" />
          ) : (
            <AlertTriangle className="h-4 w-4" />
          )}
          <AlertTitle>{a.level === "critical" ? "Gas: action needed" : "Gas: heads-up"}</AlertTitle>
          <AlertDescription>{a.message}</AlertDescription>
        </Alert>
      ))}
    </div>
  );
}
